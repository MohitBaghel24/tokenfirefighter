import { LoopResult, LoopDetectionConfig, SessionState } from './types.js';

export function checkTokenTrajectory(
  session: SessionState, 
  currentTokens: number, 
  config: LoopDetectionConfig
): LoopResult {
  const n = config.token_growth_consecutive_calls;
  const counts = [...(session.recentTokenCounts || []), currentTokens];
  
  if (counts.length < n) return { detected: false };

  const window = counts.slice(-n);
  
  let strictlyIncreasing = true;
  for (let i = 1; i < window.length; i++) {
    if (window[i] <= window[i - 1]) {
      strictlyIncreasing = false;
      break;
    }
  }

  if (strictlyIncreasing) {
    const firstCount = window[0];
    const lastCount = window[window.length - 1];
    
    if (firstCount > 0 && lastCount >= firstCount * config.token_growth_threshold) {
      const growthFactor = (lastCount / firstCount).toFixed(2);
      return {
        detected: true,
        layer: 2,
        action: 'warn',
        reason: `Tokens grew ${growthFactor}x over ${n} calls. Probable recursive retry loop.`
      };
    }
  }

  return { detected: false };
}

export function addTokenCount(session: SessionState, count: number): void {
  if (!session.recentTokenCounts) {
    session.recentTokenCounts = [];
  }
  session.recentTokenCounts.push(count);
  if (session.recentTokenCounts.length > 100) {
    session.recentTokenCounts.shift();
  }
}

export function cleanupOldTokenCounts(session: SessionState): void {
  if (session.recentTokenCounts && session.recentTokenCounts.length > 100) {
    session.recentTokenCounts = session.recentTokenCounts.slice(-100);
  }
}
