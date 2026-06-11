import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config.js';

export interface RequestRecord {
  id?: number | string;
  timestamp: string | number;
  tool: string | null;
  model: string;
  tokens_used: number;
  cost_usd: number;
}

let dbInstance: Database.Database | null = null;

export function getDbPath(): string {
  try {
    const config = loadConfig();
    return config.logging?.db_path || path.join(process.cwd(), 'data', 'requests.db');
  } catch {
    return path.join(process.cwd(), 'data', 'requests.db');
  }
}

export function initDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      tool TEXT,
      model TEXT NOT NULL,
      tokens_used INTEGER NOT NULL,
      cost_usd REAL NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

export function recordRequest(req: RequestRecord): void {
  const db = initDb();
  const timestampStr = typeof req.timestamp === 'number'
    ? new Date(req.timestamp).toISOString()
    : req.timestamp;

  const stmt = db.prepare(`
    INSERT INTO request_records (timestamp, tool, model, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(timestampStr, req.tool, req.model, req.tokens_used, req.cost_usd);
}

export function getLatestRequest(): RequestRecord | null {
  const db = initDb();
  try {
    const stmt = db.prepare(`
      SELECT * FROM request_records
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const row = stmt.get() as any;
    if (!row) return null;
    return {
      id: row.id,
      timestamp: row.timestamp,
      tool: row.tool,
      model: row.model,
      tokens_used: row.tokens_used,
      cost_usd: row.cost_usd
    };
  } catch {
    return null;
  }
}

export function getRequestCountSince(timestamp: number): number {
  const db = initDb();
  try {
    const isoStr = new Date(timestamp).toISOString();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM request_records
      WHERE timestamp >= ?
    `);
    const result = stmt.get(isoStr) as { count: number };
    return result?.count || 0;
  } catch {
    return 0;
  }
}

export function getTotalSpendToday(): number {
  const db = initDb();
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const isoStr = startOfDay.toISOString();

    const stmt = db.prepare(`
      SELECT SUM(cost_usd) as total FROM request_records
      WHERE timestamp >= ?
    `);
    const result = stmt.get(isoStr) as { total: number | null };
    return result?.total || 0;
  } catch {
    return 0;
  }
}
