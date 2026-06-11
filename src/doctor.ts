/**
 * TokenFirefighter — Doctor / Connection Test
 *
 * Diagnoses the user's setup and reports:
 * - Is the proxy running?
 * - Are API keys configured?
 * - Are environment variables pointing to the proxy?
 * - Can we reach the provider?
 * - Is any AI tool routed through TokenFirefighter?
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import { loadConfig, CONFIG_PATH } from './config.js';
import { TOOLS } from './compatibility.js';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
}

function color(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return '\x1b[32m';
  if (status === 'warn') return '\x1b[33m';
  return '\x1b[31m';
}

function icon(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return '✅';
  if (status === 'warn') return '⚠️';
  return '❌';
}

function reset(): string {
  return '\x1b[0m';
}

async function checkProxyRunning(): Promise<CheckResult> {
  const config = loadConfig();
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request({
        hostname: config.server.host,
        port: config.server.port,
        path: '/api/status',
        method: 'GET',
        timeout: 3000
      }, (res) => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
    return { name: 'Proxy Server', status: 'ok', message: `Running on ${config.server.host}:${config.server.port}` };
  } catch {
    return {
      name: 'Proxy Server',
      status: 'fail',
      message: `Not reachable at ${config.server.host}:${config.server.port}`,
      suggestion: 'Run: tokenfirefighter start'
    };
  }
}

function checkConfigExists(): CheckResult {
  if (fs.existsSync(CONFIG_PATH)) {
    return { name: 'Config File', status: 'ok', message: `Found at ${CONFIG_PATH}` };
  }
  return {
    name: 'Config File',
    status: 'warn',
    message: `Not found at ${CONFIG_PATH}`,
    suggestion: 'Run: tokenfirefighter init'
  };
}

function checkApiKeys(): CheckResult {
  const config = loadConfig();
  const keys: string[] = [];
  const missing: string[] = [];

  for (const [name, provider] of Object.entries(config.providers)) {
    if (provider.enabled) {
      const resolvedKey = provider.api_key;
      if (resolvedKey && !resolvedKey.startsWith('${') && resolvedKey.length > 20) {
        keys.push(name);
      } else {
        missing.push(name);
      }
    }
  }

  if (keys.length > 0 && missing.length === 0) {
    return { name: 'API Keys', status: 'ok', message: `Configured for: ${keys.join(', ')}` };
  }
  if (keys.length > 0 && missing.length > 0) {
    return {
      name: 'API Keys',
      status: 'warn',
      message: `Found for ${keys.join(', ')}; missing for ${missing.join(', ')}`,
      suggestion: 'Run: tokenfirefighter setup'
    };
  }
  return {
    name: 'API Keys',
    status: 'fail',
    message: 'No API keys configured for any enabled provider',
    suggestion: 'Run: tokenfirefighter setup to add your API key'
  };
}

function checkEnvVars(): CheckResult {
  const proxyVars = [
    'OPENAI_BASE_URL',
    'ANTHROPIC_BASE_URL',
    'OPENAI_API_BASE',
    'OPENAI_PROXY',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy'
  ];

  const found: string[] = [];
  for (const v of proxyVars) {
    const val = process.env[v];
    if (val) {
      if (val.includes('localhost:7272') || val.includes('127.0.0.1:7272')) {
        found.push(`${v}=${val}`);
      }
    }
  }

  if (found.length > 0) {
    return {
      name: 'Proxy Environment Variables',
      status: 'ok',
      message: `Detected: ${found.join(', ')}`,
      suggestion: undefined
    };
  }

  return {
    name: 'Proxy Environment Variables',
    status: 'warn',
    message: 'No environment variables point to localhost:7272',
    suggestion: 'Run: tokenfirefighter setup to configure your tool'
  };
}

function checkToolDetection(): CheckResult {
  const toolIds = ['claude', 'aider', 'cursor', 'kimchi', 'continue', 'opencode', 'codeium'];
  const detected: string[] = [];

  for (const id of toolIds) {
    if (id === 'kimchi') {
      // Kimchi is the user's shell — just check env for Kimchi-specific things
      if (process.env.KIMCHI_CLI || process.env.KIMCHI_HOME || (process.env.PATH || '').includes('kimchi')) {
        detected.push('Kimchi CLI');
      }
    } else if (id === 'claude') {
      if (process.env.ANTHROPIC_BASE_URL || process.env.CLAUDE_CONFIG || fs.existsSync(`${process.env.HOME}/.claude`)) {
        detected.push('Claude Code');
      }
    } else if (id === 'aider') {
      if (process.env.OPENAI_API_BASE || fs.existsSync(`${process.env.HOME}/.aider.conf.yml`)) {
        detected.push('Aider');
      }
    } else if (id === 'cursor') {
      if (fs.existsSync(`${process.env.HOME}/.cursor`)) {
        detected.push('Cursor');
      }
    } else if (id === 'continue') {
      if (fs.existsSync(`${process.env.HOME}/.continue`)) {
        detected.push('Continue.dev');
      }
    }
  }

  if (detected.length > 0) {
    return {
      name: 'AI Tool Detection',
      status: 'ok',
      message: `Detected installed tools: ${detected.join(', ')}`,
      suggestion: 'Run: tokenfirefighter setup to configure them'
    };
  }

  return {
    name: 'AI Tool Detection',
    status: 'warn',
    message: 'Could not detect any known AI tools in your environment',
    suggestion: 'Make sure your AI tool is installed and run: tokenfirefighter setup'
  };
}

async function checkProviderReachable(): Promise<CheckResult> {
  const config = loadConfig();
  const results: string[] = [];

  for (const [name, provider] of Object.entries(config.providers)) {
    if (!provider.enabled) continue;
    try {
      await new Promise<void>((resolve, reject) => {
        const url = new URL(provider.base_url);
        const req = http.request({
          hostname: url.hostname,
          port: url.port || 443,
          path: '/',
          method: 'HEAD',
          timeout: 5000
        }, (res) => {
          resolve(); // Any response means reachable
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
      });
      results.push(`${name}: reachable`);
    } catch {
      results.push(`${name}: unreachable`);
    }
  }

  if (results.length === 0) {
    return {
      name: 'Provider Reachability',
      status: 'warn',
      message: 'No providers enabled',
      suggestion: 'Check your config.yaml'
    };
  }

  const allOk = results.every(r => r.includes('reachable'));
  return {
    name: 'Provider Reachability',
    status: allOk ? 'ok' : 'warn',
    message: results.join('; '),
    suggestion: allOk ? undefined : 'Check your internet connection and API keys'
  };
}

function checkKimchiCompatibility(): CheckResult {
  const isKimchi = !!(process.env.KIMCHI_CLI || process.env.KIMCHI_HOME);
  if (!isKimchi) {
    return { name: 'Kimchi CLI', status: 'ok', message: 'Not detected (no action needed)' };
  }

  return {
    name: 'Kimchi CLI',
    status: 'warn',
    message: 'Kimchi CLI is installed but does NOT support external HTTP proxies',
    suggestion: 'TokenFirefighter cannot intercept Kimchi traffic. Use it alongside other tools like Aider or Claude Code.'
  };
}

export async function runDoctor(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   🧯 TokenFirefighter — Connection Doctor                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const checks = await Promise.all([
    checkConfigExists(),
    checkProxyRunning(),
    checkApiKeys(),
    checkEnvVars(),
    checkToolDetection(),
    checkProviderReachable(),
    checkKimchiCompatibility()
  ]);

  let failCount = 0;
  let warnCount = 0;

  for (const c of checks) {
    const col = color(c.status);
    const ic = icon(c.status);
    console.log(`  ${ic} ${col}${c.name}${reset()}`);
    console.log(`     ${c.message}`);
    if (c.suggestion) {
      console.log(`     💡 ${c.suggestion}`);
    }
    console.log('');
    if (c.status === 'fail') failCount++;
    if (c.status === 'warn') warnCount++;
  }

  // Summary verdict
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  if (failCount === 0 && warnCount === 0) {
    console.log('║  ✅ Connected and monitoring requests                                        ║');
    console.log('║     Your setup is fully configured. TokenFirefighter is ready to protect you.║');
  } else if (failCount === 0) {
    console.log('║  ⚠️  Your tool may not be using TokenFirefighter                             ║');
    console.log('║     There are warnings to address. Run "tokenfirefighter setup" to fix them. ║');
  } else {
    console.log('║  ❌ Not connected — setup is incomplete                                      ║');
    console.log('║     Critical issues were found. Run "tokenfirefighter setup" to get started. ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
}
