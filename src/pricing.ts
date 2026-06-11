export const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  
  // Anthropic
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },

  // Gemini
  'gemini-1.5-pro': { input: 3.50, output: 10.50 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },

  // Generic/Unknown Fallback
  'unknown': { input: 1.00, output: 3.00 }
};

export const MODEL_ALIASES = new Map<string, string>([
  ['gpt-4', 'gpt-4o'],
  ['gpt-4-turbo', 'gpt-4-turbo'],
  ['claude-sonnet', 'claude-3-5-sonnet'],
  ['gemini-pro', 'gemini-1.5-pro'],
  ['gemini-flash', 'gemini-1.5-flash'],
  ['models/gemini-1.5-pro', 'gemini-1.5-pro'],
  ['models/gemini-1.5-flash', 'gemini-1.5-flash']
]);

/**
 * Normalizes model names based on known aliases.
 */
export function normalizeModelName(model: string): string {
  let normalized = model.replace(/-\d{4}-?\d{2}-?\d{2}$/, '');
  
  if (MODEL_ALIASES.has(normalized)) {
    return MODEL_ALIASES.get(normalized)!;
  }
  return normalized;
}

/**
 * Returns the price for a model (USD per 1 million tokens).
 * Falls back to unknown if the model is unknown.
 */
export function getModelPrice(model: string): { input: number; output: number } {
  const normalizedModel = normalizeModelName(model);
  if (normalizedModel in PRICING_TABLE) {
    return PRICING_TABLE[normalizedModel];
  }
  // Fall back to unknown fallback
  return PRICING_TABLE['unknown'] || { input: 1.0, output: 3.0 };
}

/**
 * Add custom provider pricing from config overrides.
 */
export function addProviderPricing(overrides: Record<string, number>): void {
  for (const [model, price] of Object.entries(overrides)) {
    PRICING_TABLE[model] = { input: price, output: price };
  }
}

/**
 * Calculates the total cost for a request based on input and output tokens.
 * Returns the cost rounded to 6 decimal places.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = getModelPrice(model);
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Number(cost.toFixed(6));
}
