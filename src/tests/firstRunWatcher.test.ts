import { test, describe } from 'node:test';
import assert from 'node:assert';
import { startFirstRunTimer, markRequestReceived } from '../proxy/firstRunWatcher.js';

describe('firstRunWatcher', () => {
  test('starts timer and handles request logs', () => {
    // Should run without throwing errors
    startFirstRunTimer(12345);
    markRequestReceived('OpenAI SDK', '/v1/chat/completions');
    assert.ok(true);
  });
});
