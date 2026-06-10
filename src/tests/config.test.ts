import { test, describe } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from '../config.js';
import * as process from 'node:process';

describe('config', () => {
  test('loads config and resolves env vars', () => {
    process.env.OPENAI_API_KEY = 'test-key-123';
    const config = loadConfig();
    assert.strictEqual(config.providers.openai.api_key, 'test-key-123');
  });
});
