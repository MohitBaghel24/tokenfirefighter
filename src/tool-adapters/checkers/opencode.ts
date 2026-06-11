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

export async function checkOpenCode(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  // 1. Check binary in PATH
  const binCheck = checkBinaryInPath('opencode', 'npm install -g @opencode/cli', 'OpenCode');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    
    // 2. Version check (min 0.1.0)
    const verCheck = checkVersionSufficient('opencode', '--version', '0.1.0', 'npm install -g @opencode/cli', 'OpenCode');
    checks.push(verCheck.check);
    version = verCheck.version;

    // 3. Sandbox check
    checks.push(checkSandbox(binCheck.path, 'OpenCode', 'npm install -g @opencode/cli'));
  }

  // 4. Config checks
  const configPath = '~/.config/opencode/config.yaml';
  const resolvedConfig = resolveHomePath(configPath);

  if (!fs.existsSync(resolvedConfig)) {
    checks.push({
      pass: true,
      severity: 'info',
      message: 'No OpenCode config file exists yet. TokenFirefighter will create it during setup.'
    });
  } else {
    // Check config writable
    checks.push(checkConfigWritable(configPath, 'OpenCode'));

    // Check schema for api section
    try {
      const content = fs.readFileSync(resolvedConfig, 'utf8');
      const doc = yaml.load(content) as any;

      if (doc) {
        // Already proxied check
        const currentUrl = doc.api?.api_base || doc.api_base;
        checks.push(checkAlreadyProxied(configPath, currentUrl, 'OpenCode'));

        if (!doc.api) {
          checks.push({
            pass: true,
            severity: 'info',
            message: 'OpenCode configuration lacks "api" section. This is normal. TokenFirefighter will add it.'
          });
        } else {
          checks.push({
            pass: true,
            severity: 'info',
            message: 'OpenCode config "api" section is present.'
          });
        }
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Failed to parse OpenCode config: ${err.message}`
      });
    }
  }

  // 5. Env conflicts
  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'OpenCode',
    installed,
    version,
    compatible,
    checks
  };
}
