import { ProviderAdapter } from '../types.js';

export const openaiAdapter: ProviderAdapter = {
  name: 'openai',
  match: (reqPath: string) => {
    return reqPath.startsWith('/v1/chat/completions') || reqPath.startsWith('/v1/completions');
  },
  extractModel: (parsedBody: any) => {
    return parsedBody?.model || 'unknown';
  },
  extractUsage: (jsonResponse: any) => {
    if (jsonResponse?.usage) {
      const inputTokens = jsonResponse.usage.prompt_tokens || 0;
      const outputTokens = jsonResponse.usage.completion_tokens || 0;
      return { inputTokens, outputTokens };
    }
    return null;
  },
  getAuthHeaders: (apiKey: string) => {
    return { 'Authorization': `Bearer ${apiKey}` };
  },
  supportsByteEstimation: true
};
