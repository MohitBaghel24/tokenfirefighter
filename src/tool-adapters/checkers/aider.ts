import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
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

export async function checkAider(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  const binCheck = checkBinaryInPath('aider', 'pip install aider-chat', 'Aider');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('aider', '--version', '0.10.0', 'pip install --upgrade aider-chat', 'Aider');
    checks.push(verCheck.check);
    version = verCheck.version;

    checks.push(checkSandbox(binCheck.path, 'Aider', 'pip install --upgrade aider-chat'));
  }

  const configPath = '~/.aider.conf.yml';
  const resolved = resolveHomePath(configPath);

  if (fs.existsSync(resolved)) {
    checks.push(checkConfigWritable(configPath, 'Aider'));
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const doc = yaml.load(content) as any;
      if (doc) {
        checks.push(checkAlreadyProxied(configPath, doc['openai-api-base'] || doc['api-base'], 'Aider'));
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Failed to parse Aider config: ${err.message}`
      });
    }
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Aider',
    installed,
    version,
    compatible,
    checks
  };
}
