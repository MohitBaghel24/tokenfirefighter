import { ToolCheckReport } from './base.js';
import { checkKimchi } from './kimchi.js';
import { checkClaudeCode } from './claude-code.js';
import { checkOpenCode } from './opencode.js';
import { checkOpenaiSdk } from './openai-sdk.js';
import { checkOllama } from './ollama.js';
import { checkContinue } from './continue.js';
import { checkAider } from './aider.js';
import { checkLitellm } from './litellm.js';
import { checkJupyterAi } from './jupyter-ai.js';
import { checkContinueSelfHost } from './continue-self-host.js';
import { checkLocalai } from './localai.js';
import { checkCursor } from './cursor.js';
import { getToolBySlug } from '../../compat/registry.js';

export const CHECKER_MAP: Record<string, () => Promise<ToolCheckReport>> = {
  'kimchi': checkKimchi,
  'claude-code': checkClaudeCode,
  'opencode': checkOpenCode,
  'openai-sdk': checkOpenaiSdk,
  'ollama': checkOllama,
  'continue': checkContinue,
  'aider': checkAider,
  'litellm': checkLitellm,
  'jupyter-ai': checkJupyterAi,
  'continue-self-host': checkContinueSelfHost,
  'localai': checkLocalai,
  'cursor': checkCursor
};

/**
 * Runs the compatibility validation check for a specific tool.
 */
export async function runToolCheck(slug: string): Promise<ToolCheckReport> {
  const checker = CHECKER_MAP[slug];
  if (checker) {
    return checker();
  }

  const tool = getToolBySlug(slug);
  if (tool && tool.support === 'none') {
    return {
      tool: tool.name,
      installed: false,
      compatible: false,
      checks: [
        {
          pass: false,
          severity: 'error',
          message: `${tool.name} is not compatible with TokenFirefighter.`,
          fix: `Reason: ${tool.notes || 'Uses proprietary API or sandbox'}`
        }
      ]
    };
  }

  // Fallback for custom or unknown tools
  return {
    tool: slug,
    installed: false,
    compatible: true,
    checks: [
      {
        pass: true,
        severity: 'info',
        message: `No specific validation checker found for custom tool: ${slug}.`
      }
    ]
  };
}
