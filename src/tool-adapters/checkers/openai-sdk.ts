import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkConfigWritable, 
  checkAlreadyProxied, 
  checkEnvConflict 
} from './base.js';

export async function checkOpenaiSdk(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  // For SDK, we check if Node.js runtime is installed
  const nodeCheck = checkBinaryInPath('node', 'https://nodejs.org', 'Node.js runtime');
  checks.push(nodeCheck.check);

  if (nodeCheck.pass && nodeCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('node', '--version', '18.0.0', 'Upgrade Node.js', 'Node.js');
    checks.push(verCheck.check);
    version = verCheck.version;
  }

  // Config check: .env file in the current directory
  const configPath = './.env';
  checks.push(checkConfigWritable(configPath, 'OpenAI SDK Project env'));

  const resolvedEnvPath = path.resolve(configPath);
  if (fs.existsSync(resolvedEnvPath)) {
    try {
      const content = fs.readFileSync(resolvedEnvPath, 'utf8');
      const match = content.match(/OPENAI_BASE_URL\s*=\s*(.+)/);
      const currentUrl = match ? match[1].trim() : undefined;
      checks.push(checkAlreadyProxied(configPath, currentUrl, 'OpenAI SDK'));
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Failed to read .env file: ${err.message}`
      });
    }
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'OpenAI SDK',
    installed,
    version,
    compatible,
    checks
  };
}
