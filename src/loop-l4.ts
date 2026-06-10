import { LoopResult, LoopDetectionConfig, SessionState } from './types.js';

export function checkErrorRetryStorm(
  session: SessionState,
  responseStatus: number,
  toolName: string,
  config: LoopDetectionConfig
): LoopResult {
  const now = Date.now();
  let count = 1; // Count the current one
  
  for (const err of (session.recentErrors || [])) {
    if (err.toolName === toolName && err.errorCode === responseStatus) {
      if ((now - err.timestamp) / 1000 <= config.tool_error_retry_window_seconds) {
        count++;
      }
    }
  }

  if (count >= config.tool_error_retry_threshold) {
    return {
      detected: true,
      layer: 4,
      action: 'block',
      reason: `Error retry storm: Tool '${toolName}' errored with status ${responseStatus} repeated ${count} times within ${config.tool_error_retry_window_seconds}s.`
    };
  }

  return { detected: false };
}

export function addError(session: SessionState, status: number, toolName: string): void {
  if (!session.recentErrors) {
    session.recentErrors = [];
  }
  session.recentErrors.push({
    toolName,
    errorCode: status,
    timestamp: Date.now()
  });
  if (session.recentErrors.length > 200) {
    session.recentErrors.shift();
  }
}
