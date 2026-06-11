import { ProviderAdapter } from '../types.js';

export const geminiAdapter: ProviderAdapter = {
  name: 'gemini',
  match: (reqPath: string) => {
    return reqPath.startsWith('/v1beta/models') && reqPath.includes(':generateContent');
  },
  extractModel: (parsedBody: any) => {
    // Model is often in the URL for Gemini, but might be in body
    return parsedBody?.model || 'unknown';
  },
  extractUsage: (jsonResponse: any) => {
    if (jsonResponse?.usageMetadata) {
      const inputTokens = jsonResponse.usageMetadata.promptTokenCount || 0;
      const outputTokens = jsonResponse.usageMetadata.candidatesTokenCount || 0;
      return { inputTokens, outputTokens };
    }
    // Arrays in stream
    if (Array.isArray(jsonResponse)) {
      for (const item of jsonResponse) {
        if (item?.usageMetadata) {
          const inputTokens = item.usageMetadata.promptTokenCount || 0;
          const outputTokens = item.usageMetadata.candidatesTokenCount || 0;
          return { inputTokens, outputTokens };
        }
      }
    }
    return null;
  },
  getAuthHeaders: (apiKey: string) => {
    // Gemini usually expects apiKey in the URL query string `?key=...` 
    // Return empty here, the proxy handles appending it if empty header returned
    return {};
  },
  supportsByteEstimation: true
};
