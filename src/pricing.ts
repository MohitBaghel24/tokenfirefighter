export const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  
  // Anthropic
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 }
};

export const MODEL_ALIASES = new Map<string, string>([
  ['gpt-4', 'gpt-4o'],
  ['gpt-4-turbo', 'gpt-4-turbo'],
  ['claude-sonnet', 'claude-3-5-sonnet']
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
 * Falls back to gpt-4o if the model is unknown.
 */
export function getModelPrice(model: string): { input: number; output: number } {
  const normalizedModel = normalizeModelName(model);
  if (normalizedModel in PRICING_TABLE) {
    return PRICING_TABLE[normalizedModel];
  }
  // Fall back to gpt-4o
  return PRICING_TABLE['gpt-4o'];
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
