import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';

export const CONFIG_DIR = path.join(os.homedir(), '.tokenfirefighter');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.yaml');

export interface SetupConfig {
  proxy: {
    port: number;
    host: string;
  };
  budget: {
    defaultDailyUSD: number;
    alertsAt: number[];
  };
  loopDetection: {
    maxRequestsPerMinute: number;
    maxConsecutiveErrors: number;
  };
  providers?: Record<string, any>;
  logging?: Record<string, any>;
  pricing?: Record<string, any>;
  notifications?: Record<string, any>;
}

/**
 * Checks if the TokenFirefighter configuration file exists.
 */
export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

/**
 * Reads the configuration file and returns it as a parsed object.
 */
export function readConfig(): any {
  if (!configExists()) {
    return null;
  }
  try {
    const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(fileContent);
  } catch (error) {
    console.error('Error reading configuration file:', error);
    return null;
  }
}

/**
 * Writes the configuration object to CONFIG_PATH.
 */
export function writeConfig(config: any): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const yamlStr = yaml.dump(config);
    fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');
  } catch (error) {
    console.error('Error writing configuration file:', error);
    throw error;
  }
}

/**
 * Creates the default configuration file if it does not already exist.
 */
export function writeDefaultConfig(): void {
  const defaultConfig: SetupConfig = {
    proxy: {
      port: 3456,
      host: 'localhost'
    },
    budget: {
      defaultDailyUSD: 5.0,
      alertsAt: [1.0, 2.5, 4.0]
    },
    loopDetection: {
      maxRequestsPerMinute: 60,
      maxConsecutiveErrors: 5
    }
  };
  writeConfig(defaultConfig);
}
