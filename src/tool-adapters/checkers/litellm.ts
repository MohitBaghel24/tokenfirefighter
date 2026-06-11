import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkSandbox, 
  checkEnvConflict 
} from './base.js';

export async function checkLitellm(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  const binCheck = checkBinaryInPath('litellm', 'pip install litellm', 'LiteLLM');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('litellm', '--version', '0.1.0', 'pip install --upgrade litellm', 'LiteLLM');
    checks.push(verCheck.check);
    version = verCheck.version;

    checks.push(checkSandbox(binCheck.path, 'LiteLLM', 'pip install litellm'));
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'LiteLLM',
    installed,
    version,
    compatible,
    checks
  };
}
