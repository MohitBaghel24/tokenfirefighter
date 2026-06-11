import { 
  CheckResult, 
  ToolCheckReport, 
  checkBinaryInPath, 
  checkVersionSufficient, 
  checkSandbox, 
  checkEnvConflict 
} from './base.js';

export async function checkOllama(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;
  let version: string | undefined = undefined;

  const binCheck = checkBinaryInPath('ollama', 'https://ollama.com', 'Ollama');
  checks.push(binCheck.check);

  if (binCheck.pass && binCheck.path) {
    installed = true;
    const verCheck = checkVersionSufficient('ollama', '--version', '0.1.0', 'https://ollama.com', 'Ollama');
    checks.push(verCheck.check);
    version = verCheck.version;

    checks.push(checkSandbox(binCheck.path, 'Ollama', 'https://ollama.com'));
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Ollama',
    installed,
    version,
    compatible,
    checks
  };
}
