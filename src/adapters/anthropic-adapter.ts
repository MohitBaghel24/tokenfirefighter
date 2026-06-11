import { ProviderAdapter } from '../types.js';

export const anthropicAdapter: ProviderAdapter = {
  name: 'anthropic',
  match: (reqPath: string) => {
    return reqPath.startsWith('/v1/messages');
  },
  extractModel: (parsedBody: any) => {
    return parsedBody?.model || 'unknown';
  },
  extractUsage: (jsonResponse: any) => {
    if (jsonResponse?.usage) {
      const inputTokens = jsonResponse.usage.input_tokens || 0;
      const outputTokens = jsonResponse.usage.output_tokens || 0;
      return { inputTokens, outputTokens };
    }
    // Stream response could have usage in message.usage
    if (jsonResponse?.message?.usage) {
      const inputTokens = jsonResponse.message.usage.input_tokens || 0;
      const outputTokens = jsonResponse.message.usage.output_tokens || 0;
      return { inputTokens, outputTokens };
    }
    return null;
  },
  getAuthHeaders: (apiKey: string) => {
    return { 'x-api-key': apiKey };
  },
  supportsByteEstimation: true
};
