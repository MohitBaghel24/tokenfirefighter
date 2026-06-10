import { LoopResult, LoopDetectionConfig, SessionState, CallSignature } from './types.js';
import crypto from 'node:crypto';

/**
 * Generates a CallSignature by hashing the request body.
 */
export function createSignature(endpoint: string, method: string, body: string | Buffer): CallSignature {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return {
    endpoint,
    method,
    bodyHash,
    timestamp: Date.now()
  };
}

/**
 * Checks if the current signature repeats too many times within the configured time window.
 */
export function checkExactSignature(
  session: SessionState,
  current: CallSignature,
  config: LoopDetectionConfig
): LoopResult {
  const now = Date.now();
  let count = 0;

  for (const sig of session.recentSignatures) {
    if (sig.endpoint === current.endpoint && sig.bodyHash === current.bodyHash) {
      if ((now - sig.timestamp) / 1000 <= config.exact_signature_window_seconds) {
        count++;
      }
    }
  }

  if (count >= config.exact_signature_repeat_threshold) {
    const avgCost = session.callCount > 0 ? (session.sessionSpend / session.callCount) : 0;
    return {
      detected: true,
      layer: 1,
      action: 'block',
      reason: `Exact signature match repeated ${count} times within ${config.exact_signature_window_seconds}s`,
      estimated_savings_usd: count * avgCost,
      calls_in_loop: count
    };
  }

  return { detected: false };
}

/**
 * Adds a signature to the session state, keeping only the most recent 100.
 */
export function addSignature(session: SessionState, sig: CallSignature): void {
  if (!session.recentSignatures) {
    session.recentSignatures = [];
  }
  
  session.recentSignatures.push(sig);
  
  if (session.recentSignatures.length > 100) {
    session.recentSignatures.splice(0, session.recentSignatures.length - 100);
  }
}

/**
 * Cleans up signatures older than the given window in seconds.
 */
export function cleanupOldSignatures(session: SessionState, windowSeconds: number): void {
  if (!session.recentSignatures) return;
  const cutoff = Date.now() - windowSeconds * 1000;
  session.recentSignatures = session.recentSignatures.filter(sig => sig.timestamp >= cutoff);
}
