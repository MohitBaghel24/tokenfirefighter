import test from 'node:test';
import assert from 'node:assert';
import { detectProvider } from '../adapters/index.js';

test('detectProvider matches correctly', () => {
  assert.strictEqual(detectProvider('/v1/chat/completions').name, 'openai');
  assert.strictEqual(detectProvider('/v1/messages').name, 'anthropic');
  assert.strictEqual(detectProvider('/v1beta/models/gemini-pro:generateContent').name, 'gemini');
  assert.strictEqual(detectProvider('/unknown/endpoint').name, 'generic');
});

test('openaiAdapter extracts usage', () => {
  const adapter = detectProvider('/v1/chat/completions');
  const usage = adapter.extractUsage({ usage: { prompt_tokens: 10, completion_tokens: 5 } }, '');
  assert.deepStrictEqual(usage, { inputTokens: 10, outputTokens: 5 });
});

test('anthropicAdapter extracts usage', () => {
  const adapter = detectProvider('/v1/messages');
  const usage = adapter.extractUsage({ usage: { input_tokens: 10, output_tokens: 5 } }, '');
  assert.deepStrictEqual(usage, { inputTokens: 10, outputTokens: 5 });
});

test('geminiAdapter extracts usage', () => {
  const adapter = detectProvider('/v1beta/models/gemini:generateContent');
  const usage = adapter.extractUsage({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }, '');
  assert.deepStrictEqual(usage, { inputTokens: 10, outputTokens: 5 });
});

test('genericAdapter extracts usage', () => {
  const adapter = detectProvider('/unknown');
  
  // Test direct format
  let usage = adapter.extractUsage({ prompt_tokens: 10, completion_tokens: 5 }, '');
  assert.deepStrictEqual(usage, { inputTokens: 10, outputTokens: 5 });

  // Test regex fallback
  usage = adapter.extractUsage(null, '{"prompt_tokens": 10, "completion_tokens": 5}');
  assert.deepStrictEqual(usage, { inputTokens: 10, outputTokens: 5 });
});
