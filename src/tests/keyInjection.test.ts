import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import { 
  detectTargetProviderName, 
  extractInboundApiKey, 
  isPlaceholderKey, 
  getProviderDisplayName 
} from '../proxy.js';

describe('key injection and detection helpers', () => {
  test('detects provider name from custom target, path, or headers', () => {
    // 1. Path detection
    const req1 = { headers: {} } as unknown as http.IncomingMessage;
    assert.strictEqual(detectTargetProviderName(req1, '/v1/messages'), 'anthropic');
    assert.strictEqual(detectTargetProviderName(req1, '/v1beta/models/gemini-pro:generateContent'), 'gemini');
    assert.strictEqual(detectTargetProviderName(req1, '/v1/chat/completions'), 'openai');

    // 2. Custom target header detection
    const req2 = {
      headers: {
        'x-tokenfirefighter-target': 'https://api.mistral.ai'
      }
    } as unknown as http.IncomingMessage;
    assert.strictEqual(detectTargetProviderName(req2, '/v1/chat/completions'), 'mistral');

    const req3 = {
      headers: {
        'x-tokenfirefighter-target': 'https://api.groq.com/openai'
      }
    } as unknown as http.IncomingMessage;
    assert.strictEqual(detectTargetProviderName(req3, '/v1/chat/completions'), 'groq');

    // 3. Header prefix detection
    const req4 = {
      headers: {
        'authorization': 'Bearer gsk_test_key_123'
      }
    } as unknown as http.IncomingMessage;
    assert.strictEqual(detectTargetProviderName(req4, '/v1/chat/completions'), 'groq');
  });

  test('extracts inbound api key from multiple formats', () => {
    const req1 = {
      headers: {
        'authorization': 'Bearer sk-proj-12345'
      }
    } as unknown as http.IncomingMessage;
    assert.strictEqual(extractInboundApiKey(req1, '/v1/chat/completions'), 'sk-proj-12345');

    const req2 = {
      headers: {
        'x-api-key': 'sk-ant-abc'
      }
    } as unknown as http.IncomingMessage;
    assert.strictEqual(extractInboundApiKey(req2, '/v1/messages'), 'sk-ant-abc');

    const req3 = { headers: {} } as unknown as http.IncomingMessage;
    assert.strictEqual(extractInboundApiKey(req3, '/v1beta/models?key=AIzaSy_gemini_key'), 'AIzaSy_gemini_key');
    assert.strictEqual(extractInboundApiKey(req3, '/v1/chat/completions'), null);
  });

  test('correctly identifies placeholder or dummy keys', () => {
    assert.ok(isPlaceholderKey(''));
    assert.ok(isPlaceholderKey('dummy-tokenfirefighter-key'));
    assert.ok(isPlaceholderKey('placeholder-key'));
    assert.ok(isPlaceholderKey('tf-key'));
    assert.ok(isPlaceholderKey('sk-placeholder'));
    assert.ok(!isPlaceholderKey('sk-proj-real-key-123'));
  });

  test('resolves friendly provider display names', () => {
    assert.strictEqual(getProviderDisplayName('openai'), 'OpenAI');
    assert.strictEqual(getProviderDisplayName('anthropic'), 'Anthropic');
    assert.strictEqual(getProviderDisplayName('gemini'), 'Google (Gemini)');
    assert.strictEqual(getProviderDisplayName('google'), 'Google (Gemini)');
    assert.strictEqual(getProviderDisplayName('mistral'), 'Mistral');
    assert.strictEqual(getProviderDisplayName('groq'), 'Groq');
    assert.strictEqual(getProviderDisplayName('unknown'), 'unknown');
  });
});
