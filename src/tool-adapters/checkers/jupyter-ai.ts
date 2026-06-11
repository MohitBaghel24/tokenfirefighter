import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkSandbox, 
  checkEnvConflict 
} from './base.js';

export async function checkJupyterAi(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  const binCheck = checkBinaryInPath('jupyter', 'pip install jupyter jupyter-ai', 'Jupyter');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('jupyter', '--version', '1.0.0', 'pip install --upgrade jupyter-ai', 'Jupyter');
    checks.push(verCheck.check);
    version = verCheck.version;

    checks.push(checkSandbox(binCheck.path, 'Jupyter AI', 'pip install jupyter jupyter-ai'));
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Jupyter AI',
    installed,
    version,
    compatible,
    checks
  };
}
