import { checkContinue } from './continue.js';
import { ToolCheckReport } from './base.js';

export async function checkContinueSelfHost(): Promise<ToolCheckReport> {
  const report = await checkContinue();
  return {
    ...report,
    tool: 'Continue.dev (self-host)'
  };
}
