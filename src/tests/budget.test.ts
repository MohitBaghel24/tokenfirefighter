import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { checkBudget, resetSessionBudget, resetDailyBudget } from '../budget.js';

describe('budget', () => {
  const sessionId = 'test-session';
  const config = {
    daily_max_usd: 50,
    session_max_usd: 10,
    hourly_alert_usd: 5,
    per_request_max_usd: 2
  };

  beforeEach(() => {
    resetSessionBudget(sessionId);
    resetDailyBudget(sessionId);
  });

  test('call under cap is allowed', () => {
    const result = checkBudget(sessionId, 1.0, config);
    assert.strictEqual(result.allowed, true);
  });

  test('call that exceeds cap is blocked', () => {
    const result = checkBudget(sessionId, 15.0, config);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason?.includes('Session budget exceeded'), true);
  });

  test('call at 85% gives a warning', () => {
    const warnConfig = { ...config, session_max_usd: 100 };
    const result = checkBudget(sessionId, 42.5, warnConfig);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason?.includes('Warning: You have used over 80%'), true);
  });

  test('reset daily budget works', () => {
    const warnConfig = { ...config, session_max_usd: 100 };
    checkBudget(sessionId, 45.0, warnConfig); 
    resetDailyBudget(sessionId); 
    const result = checkBudget(sessionId, 45.0, warnConfig); 
    assert.strictEqual(result.allowed, true);
  });
});
