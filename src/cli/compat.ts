import { TOOL_REGISTRY } from '../compat/registry.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function getVisibleLength(str: string): number {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  let len = 0;
  for (const char of stripped) {
    const code = char.charCodeAt(0);
    if (char === '✅' || char === '⚠️' || char === '❌') {
      len += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      len += 2;
    } else if (char === '\ufe0f') {
      // ignore variation selector
    } else {
      len += 1;
    }
  }
  return len;
}

function padRight(str: string, width: number): string {
  const vLen = getVisibleLength(str);
  if (vLen >= width) return str;
  return str + ' '.repeat(width - vLen);
}

export function runCliCompat() {
  console.log(`\n  ${BOLD}TokenFirefighter Compatibility${RESET}`);
  console.log('  ═══════════════════════════════════════════════════════\n');

  console.log(`  ${GREEN}✅ Fully Supported${RESET}        ${YELLOW}⚠️  Partially Supported${RESET}      ${RED}❌ Not Supported${RESET}`);
  console.log('  ────────────────────────────────────────────────────────────────────────\n');

  const fullSupport = TOOL_REGISTRY.filter(t => t.support === 'full');
  const partialSupport = TOOL_REGISTRY.filter(t => t.support === 'partial');
  const noSupport = TOOL_REGISTRY.filter(t => t.support === 'none');

  const maxLen = Math.max(fullSupport.length, partialSupport.length, noSupport.length);

  for (let i = 0; i < maxLen; i++) {
    const col1 = i < fullSupport.length ? `✅ ${fullSupport[i].name}` : '';
    const col2 = i < partialSupport.length ? `⚠️  ${partialSupport[i].name}` : '';
    const col3 = i < noSupport.length ? `❌ ${noSupport[i].name}` : '';

    const pCol1 = padRight(col1, 28);
    const pCol2 = padRight(col2, 29);
    const pCol3 = padRight(col3, 28);

    console.log(`  ${pCol1}${pCol2}${pCol3}`);
  }

  console.log('\n  ────────────────────────────────────────────────────────────────────────');
  console.log('  Legend:');
  console.log(`    ${GREEN}✅${RESET} = Auto-configured via setup wizard`);
  console.log(`    ${YELLOW}⚠️${RESET}  = Requires manual configuration (see docs)`);
  console.log(`    ${RED}❌${RESET}  = Incompatible or not yet supported\n`);
  console.log('  Run \x1b[36mtokenfirefighter setup\x1b[0m to configure a supported tool.\n');
}
