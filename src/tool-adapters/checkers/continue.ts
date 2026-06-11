import * as fs from 'node:fs';
import { 
  CheckResult, 
  ToolCheckReport, 
  checkConfigWritable, 
  checkAlreadyProxied, 
  checkEnvConflict, 
  resolveHomePath 
} from './base.js';

export async function checkContinue(): Promise<ToolCheckReport> {
  const checks: CheckResult[] = [];
  let installed = false;

  const configPath = '~/.continue/config.json';
  const resolved = resolveHomePath(configPath);

  if (fs.existsSync(resolved)) {
    installed = true;
    checks.push({
      pass: true,
      severity: 'info',
      message: 'Continue.dev settings file found.'
    });

    checks.push(checkConfigWritable(configPath, 'Continue.dev'));

    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const doc = JSON.parse(content);
      
      if (doc && Array.isArray(doc.models)) {
        let currentUrl: string | undefined = undefined;
        // Search for a model with a configured apiBase
        for (const m of doc.models) {
          if (m.apiBase) {
            currentUrl = m.apiBase;
            break;
          }
        }
        checks.push(checkAlreadyProxied(configPath, currentUrl, 'Continue.dev'));
      }
    } catch (err: any) {
      checks.push({
        pass: false,
        severity: 'error',
        message: `Continue.dev config is not valid JSON: ${err.message}`,
        fix: `Repair config file at: ${configPath}`
      });
    }
  } else {
    checks.push({
      pass: false,
      severity: 'warning',
      message: 'No Continue.dev config file found. Install Continue extension and run it first.',
      fix: 'Install Continue.dev VS Code or JetBrains extension'
    });
  }

  checks.push(...checkEnvConflict());

  const compatible = checks.every(c => c.pass || c.severity !== 'error');

  return {
    tool: 'Continue.dev',
    installed,
    compatible,
    checks
  };
}
