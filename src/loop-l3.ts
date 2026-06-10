import { LoopResult, LoopDetectionConfig, SessionState } from './types.js';

function getWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\w+/g) || [];
  return new Set(words);
}

function calculateJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

export function checkContentSimilarity(
  session: SessionState,
  currentBody: string,
  config: LoopDetectionConfig
): LoopResult {
  if (session.lastCallStatus !== 'warning') {
    return { detected: false };
  }

  const n = config.content_similarity_consecutive_calls;
  const bodies = session.recentBodies || [];
  
  // We need to compare currentBody against the last `n` bodies
  if (bodies.length < n) return { detected: false };

  const recent = bodies.slice(-n);
  const currentWords = getWords(currentBody);
  
  let allSimilar = true;
  for (const oldBody of recent) {
    const oldWords = getWords(oldBody);
    const sim = calculateJaccard(currentWords, oldWords);
    if (sim < config.content_similarity_threshold) {
      allSimilar = false;
      break;
    }
  }

  if (allSimilar) {
    return {
      detected: true,
      layer: 3,
      action: 'block',
      reason: `Content similarity >= ${config.content_similarity_threshold} for last ${n} consecutive calls.`
    };
  }

  return { detected: false };
}

export function addBody(session: SessionState, body: string): void {
  if (!session.recentBodies) {
    session.recentBodies = [];
  }
  session.recentBodies.push(body);
  if (session.recentBodies.length > 50) {
    session.recentBodies.shift();
  }
}
