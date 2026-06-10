import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { Config } from './types.js';

export const CONFIG_DIR = path.join(os.homedir(), '.tokenfirefighter');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.yaml');

export const DEFAULT_CONFIG: Config = {
  server: {
    port: 7272,
    host: '127.0.0.1',
    request_timeout_ms: 120000
  },
  budget: {
    daily_max_usd: 50,
    session_max_usd: 10,
    hourly_alert_usd: 5,
    per_request_max_usd: 2
  },
  loop_detection: {
    enabled: true,
    exact_signature_repeat_threshold: 5,
    exact_signature_window_seconds: 60,
    token_growth_threshold: 1.5,
    token_growth_consecutive_calls: 10,
    content_similarity_threshold: 0.85,
    content_similarity_consecutive_calls: 3,
    tool_error_retry_threshold: 10,
    tool_error_retry_window_seconds: 60
  },
  notifications: {
    on_loop_detected: true,
    on_budget_80_percent: true,
    on_budget_100_percent: true,
    terminal_bell: true
  },
  providers: {
    openai: {
      api_key: '${OPENAI_API_KEY}',
      base_url: 'https://api.openai.com',
      enabled: true
    },
    anthropic: {
      api_key: '${ANTHROPIC_API_KEY}',
      base_url: 'https://api.anthropic.com',
      enabled: true
    }
  },
  logging: {
    level: 'info',
    db_path: path.join(CONFIG_DIR, 'logs', 'tokenfirefighter.db'),
    max_history_days: 90,
    print_to_stdout: true,
    export_format: 'json'
  },
  pricing: {
    auto_refresh: true,
    refresh_interval_hours: 24,
    custom_overrides: {}
  }
};

/**
 * Checks if an item is a plain object.
 */
function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merges source into target.
 */
function mergeDeep(target: any, source: any): any {
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * Resolves environment variables in strings formatted as ${VAR_NAME}.
 */
function resolveEnvVars(config: any): any {
  if (typeof config === 'string') {
    return config.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }
  if (typeof config === 'object' && config !== null) {
    if (Array.isArray(config)) {
      return config.map(resolveEnvVars);
    }
    const resolved: any = {};
    for (const [key, value] of Object.entries(config)) {
      resolved[key] = resolveEnvVars(value);
    }
    return resolved;
  }
  return config;
}

/**
 * Loads configuration from CONFIG_PATH if it exists, merges with DEFAULT_CONFIG,
 * and resolves environment variables.
 */
export function loadConfig(): Config {
  let loadedConfig: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    loadedConfig = yaml.load(fileContent) || {};
  }
  
  const merged = mergeDeep(DEFAULT_CONFIG, loadedConfig);
  return resolveEnvVars(merged) as Config;
}

/**
 * Creates CONFIG_DIR and logs dir, and writes DEFAULT_CONFIG to CONFIG_PATH
 * if it doesn't already exist.
 */
export function initConfig(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  const logsDir = path.join(CONFIG_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    const yamlStr = yaml.dump(DEFAULT_CONFIG);
    fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');
  }
}
