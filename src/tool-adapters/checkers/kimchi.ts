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

export async function checkKimchi(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  // 1. Check binary in PATH
  const binCheck = checkBinaryInPath('kimchi', 'npm install -g @kimchi/cli', 'Kimchi');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    
    // 2. Version check (min 0.1.0)
    const verCheck = checkVersionSufficient('kimchi', '--version', '0.1.0', 'npm update -g @kimchi/cli', 'Kimchi');
    checks.push(verCheck.check);
    version = verCheck.version;

    // 3. Sandbox check
    checks.push(checkSandbox(binCheck.path, 'Kimchi', 'npm install -g @kimchi/cli'));
  }

  // 4. Config checks
  const configPath = '~/.kimchi/config.yaml';
  const resolvedConfig = resolveHomePath(configPath);

  if (!fs.existsSync(resolvedConfig)) {
    checks.push({
      pass: false,
      severity: 'warning',
      message: 'No Kimchi config found. Run Kimchi at least once, then retry.',
      fix: 'kimchi start'
    });
  } else {
    // Check config writable
    checks.push(checkConfigWritable(configPath, 'Kimchi'));

    // Check config contents (schema version & proxy URL)
    try {
      const content = fs.readFileSync(resolvedConfig, 'utf8');
      const doc = yaml.load(content) as any;

      if (doc) {
        // Already proxied check
        checks.push(checkAlreadyProxied(configPath, doc.apiBaseUrl, 'Kimchi'));

        // Version schema check
        if (doc.version && parseFloat(doc.version) < 0.1) {
          checks.push({
            pass: false,
            severity: 'error',
            message: 'Your Kimchi config version is too old. Upgrade Kimchi to v0.1+.',
            fix: 'npm update -g @kimchi/cli'
          });
        } else {
          checks.push({
            pass: true,
            severity: 'info',
            message: 'Kimchi config version is sufficient.'
          });
        }

        // VS Code override check
        if (doc.editorMode === 'vscode' || doc.ignoreUserConfig === true || process.env.KIMCHI_VSCODE === 'true') {
          checks.push({
            pass: false,
            severity: 'error',
            message: 'Kimchi is running in a mode that ignores user config (e.g. VS Code extension with custom settings).',
            fix: 'Set editorMode to normal or disable ignoreUserConfig in ~/.kimchi/config.yaml'
          });
        }
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Failed to parse Kimchi config: ${err.message}`
      });
    }
  }

  // 5. Env conflicts
  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Kimchi',
    installed,
    version,
    compatible,
    checks
  };
}
