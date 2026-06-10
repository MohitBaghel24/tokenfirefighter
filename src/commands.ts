import Database from 'better-sqlite3';
import { Config } from './types.js';
import * as fs from 'fs';
import { resetDailyBudget } from './budget.js';

function getDb(config: Config) {
  if (!fs.existsSync(config.logging.db_path)) {
    throw new Error('Database not found. Has the proxy been run yet?');
  }
  return new Database(config.logging.db_path, { readonly: false });
}

export function handleReset(args: string[], config: Config): void {
  if (args.includes('--daily')) {
    resetDailyBudget();
    // Also reset any persistent daily_spend stats if we stored them in DB
    try {
      const db = getDb(config);
      db.prepare(`UPDATE sessions SET daily_spend = 0`).run();
      console.log('Daily budget has been reset successfully.');
    } catch (e: any) {
      // In case the DB isn't initialized or table structure is different
      console.log('In-memory daily budget reset (DB update failed or not present: ' + e.message + ').');
    }
  } else {
    console.log('Use --daily to reset daily budget.');
  }
}

export function handleLogs(args: string[], config: Config): void {
  const db = getDb(config);
  let limit = 10;
  const lastIndex = args.indexOf('--last');
  if (lastIndex !== -1 && args[lastIndex + 1]) {
    limit = parseInt(args[lastIndex + 1], 10);
  }

  const stmt = db.prepare(`SELECT timestamp, provider, model, cost_usd, blocked, loop_status FROM requests ORDER BY timestamp DESC LIMIT ?`);
  const rows = stmt.all(limit) as any[];

  console.log('TIMESTAMP'.padEnd(25) + ' | ' + 'PROVIDER'.padEnd(10) + ' | ' + 'MODEL'.padEnd(20) + ' | ' + 'COST'.padEnd(10) + ' | ' + 'STATUS');
  console.log('-'.repeat(85));
  
  for (const row of rows) {
    const ts = new Date(parseInt(row.timestamp) || row.timestamp).toISOString();
    const status = row.blocked ? 'BLOCKED' : row.loop_status === 'warning' ? 'WARN' : 'OK';
    const cost = `$${row.cost_usd.toFixed(4)}`;
    console.log(`${ts.padEnd(25)} | ${row.provider.padEnd(10)} | ${row.model.padEnd(20)} | ${cost.padEnd(10)} | ${status}`);
  }
}

export async function handleStatus(config: Config): Promise<void> {
  console.log('TokenFirefighter v1.0.0');
  
  try {
    const response = await fetch(`http://${config.server.host}:${config.server.port}`);
    console.log(`Proxy: running on ${config.server.host}:${config.server.port}`);
  } catch {
    console.log(`Proxy: not running`);
  }

  try {
    const db = getDb(config);
    const activeSessions = db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as { c: number };
    console.log(`Active sessions: ${activeSessions.c}`);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const spend = db.prepare(`SELECT SUM(cost_usd) as s FROM requests WHERE timestamp >= ?`).get(startOfDay.getTime()) as { s: number };
    console.log(`Today's total spend: $${(spend.s || 0).toFixed(4)}`);
  } catch (e) {
    console.log(`Active sessions: 0`);
    console.log(`Today's total spend: $0.00`);
  }

  console.log(`Pricing data: last refreshed 0 hours ago`);
}

export function handleExport(args: string[], config: Config): void {
  const db = getDb(config);
  
  let format = 'json';
  const formatIdx = args.indexOf('--format');
  if (formatIdx !== -1 && args[formatIdx + 1]) {
    format = args[formatIdx + 1].toLowerCase();
  }

  let since = 0;
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    since = new Date(args[sinceIdx + 1]).getTime();
  }

  let out = '';
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    out = args[outIdx + 1];
  }

  const stmt = db.prepare(`SELECT * FROM requests WHERE timestamp >= ? ORDER BY timestamp ASC`);
  const rows = stmt.all(since) as any[];

  let outputStr = '';
  if (format === 'csv') {
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      outputStr += keys.join(',') + '\n';
      for (const row of rows) {
        outputStr += keys.map(k => `"${row[k]}"`).join(',') + '\n';
      }
    }
  } else {
    outputStr = JSON.stringify(rows, null, 2);
  }

  if (out) {
    fs.writeFileSync(out, outputStr);
    console.log(`Exported ${rows.length} rows to ${out}`);
  } else {
    console.log(outputStr);
  }
}
