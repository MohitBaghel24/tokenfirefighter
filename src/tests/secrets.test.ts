import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSecretsPath, loadSecrets, saveSecrets, storeKey, removeKey, maskKey } from '../config/secrets.js';

describe('secrets storage', () => {
  test('resolves file paths and manages keys', () => {
    const secretsPath = getSecretsPath();
    assert.ok(secretsPath.endsWith('secrets.yaml'));

    // Back up existing secrets
    const hasOriginal = fs.existsSync(secretsPath);
    let originalSecrets = '';
    if (hasOriginal) {
      originalSecrets = fs.readFileSync(secretsPath, 'utf8');
    }

    try {
      // Test save & load
      const testSecrets = {
        openai: 'sk-proj-test1234openai',
        anthropic: 'sk-ant-test1234anthropic',
        google: 'AIzaSyTestGoogle'
      };

      saveSecrets(testSecrets);
      const loaded = loadSecrets();

      assert.strictEqual(loaded.openai, 'sk-proj-test1234openai');
      assert.strictEqual(loaded.anthropic, 'sk-ant-test1234anthropic');
      assert.strictEqual(loaded.google, 'AIzaSyTestGoogle');

      // Test storeKey updates
      storeKey('mistral', 'mistral-test-key');
      const loadedAfterStore = loadSecrets();
      assert.strictEqual(loadedAfterStore.mistral, 'mistral-test-key');

      // Test removeKey
      removeKey('openai');
      const loadedAfterRemove = loadSecrets();
      assert.strictEqual(loadedAfterRemove.openai, undefined);
      assert.strictEqual(loadedAfterRemove.anthropic, 'sk-ant-test1234anthropic');

    } finally {
      // Restore backups
      if (hasOriginal) {
        fs.writeFileSync(secretsPath, originalSecrets, 'utf8');
      } else if (fs.existsSync(secretsPath)) {
        fs.unlinkSync(secretsPath);
      }
    }
  });

  test('masks API keys appropriately', () => {
    assert.strictEqual(maskKey(''), '(not configured)');
    assert.strictEqual(maskKey('sk-ant-12345abcde'), 'sk-ant-...bcde');
    assert.strictEqual(maskKey('sk-proj-xyz123'), 'sk-proj-...z123');
    assert.strictEqual(maskKey('gsk_12345'), 'gsk_...2345');
    assert.strictEqual(maskKey('AIzaSy12345'), 'AIzaSy...2345');
    assert.strictEqual(maskKey('plainkey'), 'plai...nkey');
    assert.strictEqual(maskKey('short'), '...');
  });
});
