import { runToolCheck, CHECKER_MAP } from '../tool-adapters/checkers/index.js';
import { TOOL_REGISTRY } from '../compat/registry.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/**
 * Extracts a clean display label from a check's message.
 */
function getCheckLabel(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('binary') || m.includes('cli not found') || m.includes('node.js runtime') || m.includes('found at')) return 'Binary found';
  if (m.includes('version')) return 'Version OK';
  if (m.includes('writable') || m.includes('write')) return 'Config writable';
  if (m.includes('sandbox')) return 'Not sandboxed';
  if (m.includes('conflict') || m.includes('proxy environment')) return 'No conflicts';
  if (m.includes('already using another proxy')) return 'Proxy settings';
  if (m.includes('settings file not found')) return 'Settings file';
  if (m.includes('config file did not exist') || m.includes('no kimchi config') || m.includes('settings file not found')) return 'Config exists';
  if (m.includes('editor') || m.includes('mode')) return 'Config mode';
  return 'Verification';
}

/**
 * Prints a friendly warning/error description block for non-developers.
 */
export function printFriendlyErrorBlock(report: { tool: string; checks: any[] }): void {
  for (const check of report.checks) {
    if (!check.pass && check.severity === 'error') {
      console.log(`\n  ${RED}❌ Problem: ${check.message}${RESET}`);
      console.log(`\n  ${BOLD}Why this matters:${RESET} TokenFirefighter needs to find and write to ${report.tool} to automatically configure proxy settings.`);
      if (check.fix) {
        console.log(`\n  ${BOLD}How to fix:${RESET} Run this command, then restart your terminal:`);
        console.log(`    ${CYAN}${check.fix}${RESET}`);
      }
      if (check.docsUrl) {
        console.log(`\n  ${BOLD}Need help? See:${RESET} ${check.docsUrl}`);
      } else {
        console.log(`\n  ${BOLD}Need help? See:${RESET} https://tokenfirefighter.dev/docs/${report.tool.toLowerCase().replace(/\s+/g, '-')}-setup`);
      }
    }
  }
  console.log('');
}

/**
 * Formats and prints the check report for a single tool.
 */
export function printToolCheckReport(report: any): boolean {
  console.log(`\n  Checking ${report.tool} compatibility...`);
  console.log('  ─────────────────────────────────────────────────────────');

  // De-duplicate checks by label to display them cleanly
  const displayedLabels = new Set<string>();
  
  for (const check of report.checks) {
    const label = getCheckLabel(check.message);
    if (displayedLabels.has(label)) {
      // Keep error checks over info checks for the same label
      continue;
    }
    displayedLabels.add(label);

    let mark = `${GREEN}✓${RESET}`;
    if (!check.pass) {
      if (check.severity === 'error') mark = `${RED}✗${RESET}`;
      else if (check.severity === 'warning') mark = `${YELLOW}⚠️${RESET}`;
      else mark = `${CYAN}ℹ${RESET}`;
    }

    // Detail suffix extracted from the message or default
    let detail = '';
    const versionMatch = check.message.match(/version\s+([v0-9.]+)/i) || check.message.match(/found\s+v?([0-9.]+)/i);
    if (versionMatch) {
      detail = versionMatch[0].replace('version ', 'v').replace('found ', 'v');
    } else if (check.message.includes('writable')) {
      const matchPath = check.message.match(/:\s*(.+)/);
      detail = matchPath ? matchPath[1] : '';
    } else if (check.message.includes('sandbox')) {
      detail = check.pass ? '(native install)' : '(sandboxed)';
    }

    console.log(`  ${(label + ' ').padEnd(20, '.')} ${mark}  ${detail}`);
  }
  
  console.log('  ─────────────────────────────────────────────────────────');

  if (report.compatible) {
    console.log(`  Result: ${GREEN}✅ ${report.tool} is ready to use with TokenFirefighter.${RESET}\n`);
    return true;
  } else {
    console.log(`  Result: ${RED}❌ ${report.tool} cannot use TokenFirefighter yet.${RESET}\n`);
    
    // Find the primary fix command if any
    const firstErrorWithFix = report.checks.find((c: any) => !c.pass && c.severity === 'error' && c.fix);
    if (firstErrorWithFix) {
      console.log(`  ${BOLD}Fix it:${RESET}`);
      console.log(`    ${CYAN}${firstErrorWithFix.fix}${RESET}\n`);
    }
    
    console.log(`  Then run: ${CYAN}tokenfirefighter setup ${report.tool.toLowerCase().replace(/\s+/g, '-')}${RESET}\n`);
    printFriendlyErrorBlock(report);
    return false;
  }
}

/**
 * Command line entry point for tokenfirefighter check.
 */
export async function runCliCheck(args: string[]): Promise<void> {
  const toolArg = args[1];

  if (toolArg) {
    // Check specific tool
    const slug = toolArg.toLowerCase().trim();
    const matched = TOOL_REGISTRY.find(t => t.slug === slug || t.name.toLowerCase() === slug);
    
    if (!matched) {
      console.log(`\n  ${RED}Error: Tool "${toolArg}" not found in compatibility registry.${RESET}`);
      console.log(`  Run: ${CYAN}tokenfirefighter compat${RESET} to see a list of supported tools.\n`);
      return;
    }

    const report = await runToolCheck(matched.slug);
    printToolCheckReport(report);
  } else {
    // Auto-detect installed tools and check all of them
    console.log(`\n  ${BOLD}TokenFirefighter Auto-Detecting AI Tools...${RESET}`);
    console.log('  ──────────────────────────────────────────');

    let detectedAny = false;
    const slugs = Object.keys(CHECKER_MAP);

    for (const slug of slugs) {
      const report = await runToolCheck(slug);
      if (report.installed) {
        detectedAny = true;
        printToolCheckReport(report);
      }
    }

    if (!detectedAny) {
      console.log(`  ${YELLOW}No installed AI tools were auto-detected on your system.${RESET}`);
      console.log(`  Please specify a tool to check: ${CYAN}tokenfirefighter check <tool>${RESET}\n`);
    }
  }
}
