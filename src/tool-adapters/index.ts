import { kimchiAdapter } from './kimchi.js';
import { claudeCodeAdapter } from './claude-code.js';
import { opencodeAdapter } from './opencode.js';
import { openaiSdkAdapter } from './openai-sdk.js';
import { continueAdapter } from './continue.js';
import { ollamaAdapter } from './ollama.js';
import { customAdapter } from './custom.js';

export const TOOL_ADAPTERS = [
  kimchiAdapter,
  claudeCodeAdapter,
  opencodeAdapter,
  openaiSdkAdapter,
  continueAdapter,
  ollamaAdapter,
  customAdapter
];

export function getAdapterById(id: string) {
  return TOOL_ADAPTERS.find(adapter => adapter.id === id);
}
