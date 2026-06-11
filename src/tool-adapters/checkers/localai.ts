import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkSandbox, 
  checkEnvConflict 
} from './base.js';

export async function checkLocalai(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  const binCheck = checkBinaryInPath('localai', 'https://localai.io', 'LocalAI');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('localai', '--version', '1.0.0', 'https://localai.io', 'LocalAI');
    checks.push(verCheck.check);
    version = verCheck.version;

    checks.push(checkSandbox(binCheck.path, 'LocalAI', 'https://localai.io'));
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'LocalAI',
    installed,
    version,
    compatible,
    checks
  };
}
