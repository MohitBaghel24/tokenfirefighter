import process from 'node:process';

const CLEAR_SEQ = '\x1b[2J\x1b[H';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD_RED = '\x1b[1;31m';
const RESET = '\x1b[0m';

function getStatusIcon(status: string, percentage: number): string {
  if (status === 'blocked' || percentage >= 100) return `${RED}🔴${RESET}`;
  if (status === 'warning' || percentage >= 80) return `${YELLOW}🟡${RESET}`;
  return `${GREEN}🟢${RESET}`;
}

export function initDashboard(): void {
  updateDashboard({
    todaySpend: 0,
    todayCap: 50.0,
    sessionSpend: 0,
    sessionCap: 10.0,
    recentCalls: [],
    status: 'ok'
  });
}

export function updateDashboard(data: {
  todaySpend: number;
  todayCap: number;
  sessionSpend: number;
  sessionCap: number;
  recentCalls: { model: string, inputTokens: number, outputTokens: number, cost: number, status: 'ok' | 'warning' | 'blocked' }[];
  status: 'ok' | 'warning' | 'blocked';
}): void {
  const todayPct = data.todayCap > 0 ? (data.todaySpend / data.todayCap) * 100 : 0;
  const sessPct = data.sessionCap > 0 ? (data.sessionSpend / data.sessionCap) * 100 : 0;

  const todayIcon = getStatusIcon(data.status, todayPct);
  const sessIcon = getStatusIcon(data.status, sessPct);

  const tSpendStr = `$${data.todaySpend.toFixed(2)}`;
  const tCapStr = `$${data.todayCap.toFixed(2)}`;
  const sSpendStr = `$${data.sessionSpend.toFixed(2)}`;
  const sCapStr = `$${data.sessionCap.toFixed(2)}`;

  let out = CLEAR_SEQ;
  out += `╔═══════════════════════════════════════════╗\n`;
  out += `║  TokenFirefighter v1.0.0   ${GREEN}LIVE${RESET}          ║\n`;
  out += `╠═══════════════════════════════════════════╣\n`;
  
  const line1 = `  Today:   ${tSpendStr} / ${tCapStr}`;
  out += `║${line1.padEnd(38, ' ')}${todayIcon}  ║\n`;
  
  const line2 = `  Session: ${sSpendStr} / ${sCapStr}`;
  out += `║${line2.padEnd(38, ' ')}${sessIcon}  ║\n`;
  out += `║                                           ║\n`;
  out += `╠═══════════════════════════════════════════╣\n`;
  out += `║  LAST 5 CALLS                             ║\n`;

  if (data.recentCalls.length === 0) {
    out += `║  (waiting for first call...)              ║\n`;
    for(let i=0; i<4; i++) out += `║                                           ║\n`;
  } else {
    const calls = data.recentCalls.slice(0, 5);
    for (let i = 0; i < 5; i++) {
      if (i < calls.length) {
        const c = calls[i];
        const statusColor = c.status === 'blocked' ? RED : c.status === 'warning' ? YELLOW : GREEN;
        const callLine = `  ${statusColor}[${c.status.toUpperCase()}]${RESET} ${c.model} - $${c.cost.toFixed(4)}`;
        // Calculate raw length without ANSI codes for proper padding
        const rawLen = `  [${c.status.toUpperCase()}] ${c.model} - $${c.cost.toFixed(4)}`.length;
        const padding = Math.max(0, 43 - rawLen);
        out += `║${callLine}${' '.repeat(padding)}║\n`;
      } else {
        out += `║                                           ║\n`;
      }
    }
  }

  out += `╠═══════════════════════════════════════════╣\n`;
  out += `║  [q] quit  [r] reset  [p] pause  [c] cfg  ║\n`;
  out += `╚═══════════════════════════════════════════╝\n`;

  process.stdout.write(out);
}

export function showBlockAlert(reason: string, savings: number): void {
  let out = CLEAR_SEQ;
  out += `${BOLD_RED}███████████████████████████████████████████████████${RESET}\n`;
  out += `${BOLD_RED}█                                                 █${RESET}\n`;
  out += `${BOLD_RED}█  BLOCKED: LOOP OR BUDGET EXCEEDED               █${RESET}\n`;
  
  // Truncate or pad reason to fit cleanly within the block alert box (width 47)
  const paddedReason = reason.substring(0, 45).padEnd(47, ' ');
  out += `${BOLD_RED}█  ${paddedReason}█${RESET}\n`;
  
  const paddedSavings = `Est Savings: $${savings.toFixed(2)}`.padEnd(47, ' ');
  out += `${BOLD_RED}█  ${paddedSavings}█${RESET}\n`;
  out += `${BOLD_RED}█                                                 █${RESET}\n`;
  out += `${BOLD_RED}███████████████████████████████████████████████████${RESET}\n\n`;
  
  process.stdout.write(out);
}

export function setupKeyboardInput(callback: (key: string) => void): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (keyStr: string) => {
    const key = keyStr.toLowerCase();
    
    // Check for Ctrl+C (ETX = \u0003) or 'q'
    if (key === '\u0003' || key === 'q') {
      callback('quit');
      // Adding a tiny timeout to ensure stdout flushes and callback finishes before forcing exit
      setTimeout(() => process.exit(0), 10);
    } else if (key === 'r') {
      callback('reset');
    } else if (key === 'p') {
      callback('pause');
    } else if (key === 'c') {
      callback('cfg');
    }
  });
}
