import { ProviderAdapter } from '../types.js';

export const genericAdapter: ProviderAdapter = {
  name: 'generic',
  match: () => true, // Fallback match
  extractModel: (parsedBody: any) => {
    return parsedBody?.model || 'unknown';
  },
  extractUsage: (jsonResponse: any, responseStr: string) => {
    const obj = typeof jsonResponse === 'object' && jsonResponse !== null ? jsonResponse : {};
    const usage = obj.usage || obj.usageMetadata || obj.meta?.usage || {};
    
    // 1. Try explicit fields in usage object
    let inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? usage.inputTokenCount;
    let outputTokens = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? usage.outputTokenCount;

    if (inputTokens !== undefined || outputTokens !== undefined) {
      return { inputTokens: inputTokens || 0, outputTokens: outputTokens || 0 };
    }

    // 2. Try global fields
    inputTokens = obj.prompt_tokens ?? obj.input_tokens ?? obj.promptTokenCount;
    outputTokens = obj.completion_tokens ?? obj.output_tokens ?? obj.candidatesTokenCount;
    
    if (inputTokens !== undefined || outputTokens !== undefined) {
      return { inputTokens: inputTokens || 0, outputTokens: outputTokens || 0 };
    }

    // 3. Regex fallback
    const inputMatch = responseStr.match(/"prompt_tokens":\s*(\d+)|"input_tokens":\s*(\d+)|"promptTokenCount":\s*(\d+)/);
    if (inputMatch) {
      inputTokens = parseInt(inputMatch[1] || inputMatch[2] || inputMatch[3], 10);
    }
    
    const outputMatch = responseStr.match(/"completion_tokens":\s*(\d+)|"output_tokens":\s*(\d+)|"candidatesTokenCount":\s*(\d+)/);
    if (outputMatch) {
      outputTokens = parseInt(outputMatch[1] || outputMatch[2] || outputMatch[3], 10);
    }

    if (inputTokens !== undefined || outputTokens !== undefined) {
      return { inputTokens: inputTokens || 0, outputTokens: outputTokens || 0 };
    }

    return null;
  },
  getAuthHeaders: (apiKey: string) => {
    return { 'Authorization': `Bearer ${apiKey}` };
  },
  supportsByteEstimation: true
};
