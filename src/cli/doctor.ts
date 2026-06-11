import * as http from 'node:http';
import { loadConfig } from '../config.js';
import { getLatestRequest, getRequestCountSince, getTotalSpendToday } from '../db/requests.js';
import { TOOL_REGISTRY } from '../compat/registry.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function checkProxyHealth(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: host === 'localhost' || host === '127.0.0.1' ? '127.0.0.1' : host,
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 1500
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(res.statusCode === 200 && parsed.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export async function runCliDoctor() {
  console.log(`\n  ${BOLD}TokenFirefighter Doctor${RESET}`);
  console.log('  ───────────────────────');

  const config = loadConfig();
  const port = config.server?.port ?? 3456;
  const host = config.server?.host ?? 'localhost';
  const proxyUrl = `http://${host}:${port}`;

  const proxyRunning = await checkProxyHealth(port, host);
  if (!proxyRunning) {
    console.log(`  Proxy running     ${RED}✗ (unreachable)${RESET}`);
    console.log(`\n  ${RED}TokenFirefighter proxy is not running. Start it with: tokenfirefighter start${RESET}\n`);
    process.exit(1);
  }

  console.log(`  Proxy running     ${GREEN}✓ (${proxyUrl})${RESET}`);

  const latestReq = getLatestRequest();
  const now = Date.now();

  if (latestReq) {
    const latestTime = new Date(latestReq.timestamp).getTime();
    const diffSecs = Math.max(0, Math.floor((now - latestTime) / 1000));

    if (diffSecs <= 60) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const totalToday = getRequestCountSince(startOfDay.getTime());
      const spendToday = getTotalSpendToday();

      console.log(`  Requests tracked  ${GREEN}✓ (last request: ${diffSecs}s ago)${RESET}`);
      console.log(`  Total today       ${totalToday} requests`);
      console.log(`  Spend today       $${spendToday.toFixed(3)}`);
      
      const matchedTool = latestReq.tool
        ? TOOL_REGISTRY.find(t => t.name.toLowerCase() === latestReq.tool!.toLowerCase())
        : null;
      if (matchedTool && matchedTool.support === 'partial') {
        console.log(`  ${YELLOW}Tip:    Your tool is partially supported. Some features may not work correctly.${RESET}`);
      }
      
      console.log(`\n  Status: ${GREEN}Connected and monitoring requests${RESET}\n`);
    } else {
      const diffMins = Math.ceil(diffSecs / 60);
      console.log(`  Requests tracked  ${RED}✗ (no recent requests found)${RESET}`);
      console.log(`\n  Status: ${YELLOW}Your tool is not using TokenFirefighter${RESET}`);
      console.log(`  Tip:    Set your AI tool's API base URL to ${proxyUrl}`);
      console.log(`          and send a request, then run this command again.`);
      console.log(`\n  ${YELLOW}Your tool is not using TokenFirefighter. Last seen request was ${diffMins} minutes ago. Check your tool's configuration.${RESET}\n`);
      
      await runDoctorCompatibilityCheck();
    }
  } else {
    console.log(`  Requests tracked  ${RED}✗ (no recent requests found)${RESET}`);
    console.log(`\n  Status: ${YELLOW}Your tool is not using TokenFirefighter${RESET}`);
    console.log(`  Tip:    Set your AI tool's API base URL to ${proxyUrl}`);
    console.log(`          and send a request, then run this command again.`);
    console.log(`\n  ${YELLOW}Your tool is not using TokenFirefighter. Configure your AI tool to use ${proxyUrl} as its API base URL, then run this again.${RESET}\n`);
    
    await runDoctorCompatibilityCheck();
  }
}

async function runDoctorCompatibilityCheck() {
  try {
    const { readConfig } = await import('../config/manager.js');
    const rawConfig = readConfig() || {};
    const activeTool = rawConfig.active_tool;

    if (activeTool) {
      const { runToolCheck } = await import('../tool-adapters/checkers/index.js');
      const { printToolCheckReport } = await import('./check.js');
      console.log(`  [Zero Traffic Diagnostics] Running compatibility checker for: ${activeTool}`);
      const report = await runToolCheck(activeTool);
      printToolCheckReport(report);
    } else {
      console.log(`  [Zero Traffic Diagnostics] No configured active tool found in TokenFirefighter config. Run: tokenfirefighter setup`);
    }
  } catch (err: any) {
    console.log(`  [Zero Traffic Diagnostics] Failed to run compatibility check: ${err.message}`);
  }
}
