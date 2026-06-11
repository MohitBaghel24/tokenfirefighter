import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkConfigWritable, 
  checkAlreadyProxied, 
  checkSandbox, 
  checkEnvConflict, 
  resolveHomePath 
} from './base.js';

export async function checkClaudeCode(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  // 1. Check binary in PATH (checking 'claude' then 'claude-code')
  let binCheck = checkBinaryInPath('claude', 'npm install -g @anthropic-ai/claude-code', 'Claude Code');
  if (!binCheck.pass) {
    const backupCheck = checkBinaryInPath('claude-code', 'npm install -g @anthropic-ai/claude-code', 'Claude Code');
    if (backupCheck.pass) {
      binCheck = backupCheck;
    }
  }
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    
    // 2. Version check (min 0.1.0)
    const binaryName = binCheck.path.endsWith('claude-code') ? 'claude-code' : 'claude';
    const verCheck = checkVersionSufficient(binaryName, '--version', '0.1.0', 'npm install -g @anthropic-ai/claude-code@latest', 'Claude Code');
    checks.push(verCheck.check);
    version = verCheck.version;

    // 3. Sandbox check
    checks.push(checkSandbox(binCheck.path, 'Claude Code', 'npm install -g @anthropic-ai/claude-code'));

    // 4. Brew vs npm installation check
    const lowerPath = binCheck.path.toLowerCase();
    const isNpm = lowerPath.includes('npm') || lowerPath.includes('node') || lowerPath.includes('.nvm') || lowerPath.includes('pnpm') || lowerPath.includes('yarn');
    const isBrew = lowerPath.includes('brew') || lowerPath.includes('cellar');

    if (isNpm) {
      checks.push({
        pass: true,
        severity: 'info',
        message: 'Claude Code installed via npm/node (supported).'
      });
    } else if (isBrew) {
      checks.push({
        pass: true,
        severity: 'info',
        message: 'Claude Code installed via Homebrew (supported).'
      });
    } else {
      checks.push({
        pass: false,
        severity: 'warning',
        message: 'Claude Code was installed from an unknown source. It is recommended to install via npm.',
        fix: 'npm install -g @anthropic-ai/claude-code'
      });
    }
  }

  // 5. Config checks
  const path1 = resolveHomePath('~/.claude/settings.json');
  const path2 = resolveHomePath('~/.claude-cli/config.json');
  let configPath = path1;
  if (!fs.existsSync(path1) && fs.existsSync(path2)) {
    configPath = path2;
  }

  if (!fs.existsSync(configPath)) {
    checks.push({
      pass: false,
      severity: 'error',
      message: 'Claude Code settings file not found. Run "claude config set" first, then retry.',
      fix: 'claude config set primaryApiUrl http://localhost:3456'
    });
  } else {
    // Check config writable
    checks.push(checkConfigWritable(configPath, 'Claude Code'));

    // Validate config JSON format
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const doc = JSON.parse(content);

      if (doc) {
        // Already proxied check
        const currentUrl = doc.primaryApiUrl || doc.apiUrl;
        checks.push(checkAlreadyProxied(configPath, currentUrl, 'Claude Code'));
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'error',
        message: `Claude Code settings file is not valid JSON: ${err.message}`,
        fix: `Delete or repair settings file at: ${configPath}`
      });
    }
  }

  // 6. Env conflicts
  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Claude Code',
    installed,
    version,
    compatible,
    checks
  };
}
