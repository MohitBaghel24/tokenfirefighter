import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as process from 'node:process';
import * as path from 'node:path';
import { loadConfig, CONFIG_PATH } from '../config.js';

describe('config', () => {
  test('loads config and resolves env vars', () => {
    process.env.OPENAI_API_KEY = 'test-key-123';
    const config = loadConfig();
    assert.strictEqual(config.providers.openai.api_key, 'test-key-123');
  });

  test('correctly maps new setup wizard schema to standard Config', () => {
    const originalExists = fs.existsSync(CONFIG_PATH);
    let originalContent = '';
    if (originalExists) {
      originalContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    }

    try {
      const testSetupConfig = `
proxy:
  port: 9999
  host: test-host
budget:
  defaultDailyUSD: 12.34
  alertsAt: [1.0, 5.0]
loopDetection:
  maxRequestsPerMinute: 120
  maxConsecutiveErrors: 8
`;
      // Ensure directory exists
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, testSetupConfig, 'utf8');

      const config = loadConfig();

      assert.strictEqual(config.server.port, 9999);
      assert.strictEqual(config.server.host, 'test-host');
      assert.strictEqual(config.budget.daily_max_usd, 12.34);
      assert.strictEqual(config.loop_detection.exact_signature_repeat_threshold, 120);
      assert.strictEqual(config.loop_detection.tool_error_retry_threshold, 8);
    } finally {
      if (originalExists) {
        fs.writeFileSync(CONFIG_PATH, originalContent, 'utf8');
      } else if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
      }
    }
  });
});
