import { test, describe } from 'node:test';
import assert from 'node:assert';
import { checkExactSignature } from '../loop-l1.js';
import { SessionState, CallSignature, LoopDetectionConfig } from '../types.js';

describe('loop-l1', () => {
  const config: LoopDetectionConfig = {
    enabled: true,
    exact_signature_repeat_threshold: 5,
    exact_signature_window_seconds: 60,
    token_growth_threshold: 1.5,
    token_growth_consecutive_calls: 10,
    content_similarity_threshold: 0.85,
    content_similarity_consecutive_calls: 3,
    tool_error_retry_threshold: 10,
    tool_error_retry_window_seconds: 60
  };

  test('4 identical signatures -> no block', () => {
    const now = Date.now();
    const sigs: CallSignature[] = Array(4).fill({ endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: now });
    
    const session: SessionState = { recentSignatures: sigs } as any;
    const current = { endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: now };
    
    const res = checkExactSignature(session, current, config);
    assert.strictEqual(res.detected, false);
  });

  test('6 identical signatures within 60s -> block', () => {
    const now = Date.now();
    const sigs: CallSignature[] = Array(6).fill({ endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: now });
    
    const session: SessionState = { recentSignatures: sigs, sessionSpend: 1, callCount: 1 } as any;
    const current = { endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: now };
    
    const res = checkExactSignature(session, current, config);
    assert.strictEqual(res.detected, true);
    assert.strictEqual(res.action, 'block');
  });

  test('old signatures outside window ignored', () => {
    const now = Date.now();
    const oldTimestamp = now - 120 * 1000; // 120s ago
    const sigs: CallSignature[] = Array(6).fill({ endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: oldTimestamp });
    
    const session: SessionState = { recentSignatures: sigs } as any;
    const current = { endpoint: '/v1', method: 'POST', bodyHash: 'abc', timestamp: now };
    
    const res = checkExactSignature(session, current, config);
    assert.strictEqual(res.detected, false);
  });
});
