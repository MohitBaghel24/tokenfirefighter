import { ProviderAdapter } from '../types.js';
import { openaiAdapter } from './openai-adapter.js';
import { anthropicAdapter } from './anthropic-adapter.js';
import { geminiAdapter } from './gemini-adapter.js';
import { genericAdapter } from './generic-adapter.js';

const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter];

export function detectProvider(reqPath: string, headers?: Record<string, string | string[] | undefined>): ProviderAdapter {
  for (const adapter of adapters) {
    if (adapter.match(reqPath, headers)) {
      return adapter;
    }
  }
  return genericAdapter;
}
