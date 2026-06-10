import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateCost, normalizeModelName } from '../pricing.js';

describe('pricing', () => {
  test('calculateCost with gpt-4o', () => {
    const cost = calculateCost('gpt-4o', 1000, 500);
    // (1000/1e6 * 2.5) + (500/1e6 * 10) = 0.0025 + 0.005 = 0.0075
    assert.strictEqual(cost, 0.0075);
  });

  test('calculateCost with unknown model', () => {
    const cost = calculateCost('unknown-model-xyz', 1000, 500);
    assert.strictEqual(typeof cost, 'number');
  });

  test('normalizeModelName', () => {
    assert.strictEqual(normalizeModelName('gpt-4o-2024-05-13'), 'gpt-4o');
    assert.strictEqual(normalizeModelName('claude-3-5-sonnet-20240620'), 'claude-3-5-sonnet');
  });
});
