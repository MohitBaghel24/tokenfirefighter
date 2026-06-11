import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import { recordRequest, getLatestRequest, getRequestCountSince, getTotalSpendToday, getDbPath, initDb } from '../db/requests.js';

describe('doctor request tracking database', () => {
  let originalExists = false;
  let originalContent = Buffer.alloc(0);
  const dbPath = getDbPath();

  before(() => {
    // Save original database if it exists
    if (fs.existsSync(dbPath)) {
      originalExists = true;
      originalContent = fs.readFileSync(dbPath);
      fs.unlinkSync(dbPath);
    }
    // Initialize test database
    initDb();
  });

  after(() => {
    // Restore original database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (originalExists) {
      fs.writeFileSync(dbPath, originalContent);
    }
  });

  test('records and retrieves the latest request log', () => {
    const testRecord = {
      timestamp: Date.now(),
      tool: 'Claude Code',
      model: 'claude-3-5-sonnet',
      tokens_used: 120,
      cost_usd: 0.003
    };

    recordRequest(testRecord);

    const latest = getLatestRequest();
    assert.ok(latest);
    assert.strictEqual(latest.tool, 'Claude Code');
    assert.strictEqual(latest.model, 'claude-3-5-sonnet');
    assert.strictEqual(latest.tokens_used, 120);
    assert.strictEqual(latest.cost_usd, 0.003);
  });

  test('gets total spend and request counts correctly', () => {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    
    // Clear and add specific mock requests
    const db = initDb();
    db.exec('DELETE FROM request_records');

    recordRequest({
      timestamp: oneHourAgo,
      tool: 'OpenAI SDK',
      model: 'gpt-4o',
      tokens_used: 200,
      cost_usd: 0.015
    });

    recordRequest({
      timestamp: now,
      tool: 'Continue.dev',
      model: 'gpt-4o-mini',
      tokens_used: 50,
      cost_usd: 0.002
    });

    const count = getRequestCountSince(oneHourAgo);
    assert.strictEqual(count, 2);

    const spend = getTotalSpendToday();
    assert.strictEqual(spend, 0.017);
  });
});
