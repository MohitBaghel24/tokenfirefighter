const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let timer: NodeJS.Timeout | null = null;
let hasReceivedRequest = false;

/**
 * Starts a 5-minute timer to alert if no requests are received.
 */
export function startFirstRunTimer(port: number): void {
  if (timer) {
    clearTimeout(timer);
  }
  hasReceivedRequest = false;

  console.log(`\nTokenFirefighter proxy running on http://localhost:${port}`);
  console.log('Waiting for requests... (will warn at 5 min if none received)\n');

  timer = setTimeout(() => {
    if (!hasReceivedRequest) {
      console.warn(`\n${YELLOW}⚠️  No requests detected. Your AI tool may not be configured to use TokenFirefighter.`);
      console.warn(`   Make sure your tool's API base URL is set to: http://localhost:${port}`);
      console.warn(`   Run tokenfirefighter doctor to diagnose the issue.`);
      console.warn(`   Run tokenfirefighter compat to see supported tools.${RESET}\n`);
    }
  }, 300000); // 5 minutes
}

/**
 * Cancels the timer on the first request.
 */
export function markRequestReceived(toolName: string | null, urlPath: string): void {
  if (!hasReceivedRequest) {
    hasReceivedRequest = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const toolDisplay = toolName || 'unknown tool';
    console.log(`[PROXY] Request received from ${toolDisplay} at ${urlPath}`);
  }
}
