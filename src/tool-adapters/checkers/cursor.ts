import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkConfigWritable, 
  checkAlreadyProxied, 
  checkSandbox, 
  checkEnvConflict 
} from './base.js';

function getCursorSettingsPath(): string {
  if (os.platform() === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Cursor', 'User', 'settings.json');
  }
  if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
  }
  return path.join(os.homedir(), '.config', 'Cursor', 'User', 'settings.json');
}

export async function checkCursor(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;

  // Check cursor command or MacOS app package
  const binCheck = checkBinaryInPath('cursor', 'https://cursor.com', 'Cursor');
  let hasApp = false;

  if (os.platform() === 'darwin') {
    hasApp = fs.existsSync('/Applications/Cursor.app');
  }

  if (binCheck.pass || hasApp) {
    installed = true;
    checks.push({
      pass: true,
      severity: 'info',
      message: 'Cursor is installed.'
    });

    if (binCheck.path) {
      checks.push(checkSandbox(binCheck.path, 'Cursor', 'https://cursor.com'));
    }
  } else {
    checks.push(binCheck.check);
  }

  const settingsPath = getCursorSettingsPath();
  if (fs.existsSync(settingsPath)) {
    checks.push(checkConfigWritable(settingsPath, 'Cursor'));
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      const doc = JSON.parse(content);
      if (doc) {
        checks.push(checkAlreadyProxied(settingsPath, doc['openai.apiBaseUrl'] || doc['openai.apiBase'], 'Cursor'));
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Failed to parse Cursor settings.json: ${err.message}`
      });
    }
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Cursor',
    installed,
    compatible,
    checks
  };
}
