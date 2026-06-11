import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { RequestData } from './types.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  request_id TEXT UNIQUE,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  endpoint TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  loop_status TEXT DEFAULT 'ok',
  blocked INTEGER DEFAULT 0,
  block_reason TEXT,
  duration_ms INTEGER,
  http_status INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  session_id TEXT UNIQUE,
  created_at TEXT,
  last_call_at TEXT,
  total_calls INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  blocked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loop_events (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  session_id TEXT,
  layer INTEGER,
  reason TEXT,
  calls_in_loop INTEGER,
  estimated_savings_usd REAL
);

CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
`;

let db: Database.Database;

export function getDb(): Database.Database | undefined {
  return db;
}

// Prepared statements
let insertRequestStmt: Database.Statement;
let insertSessionStmt: Database.Statement;
let updateSessionStmt: Database.Statement;
let insertLoopEventStmt: Database.Statement;
let getDailySpendStmt: Database.Statement;
let getRecentRequestsStmt: Database.Statement;

/**
 * Creates parent directory if needed, runs schema SQL, and returns Database instance.
 * Sets up prepared statements for performance.
 */
export function initDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);

  insertRequestStmt = db.prepare(`
    INSERT INTO requests (
      timestamp, request_id, session_id, provider, model, endpoint,
      input_tokens, output_tokens, cost_usd, loop_status, blocked,
      block_reason, duration_ms, http_status
    ) VALUES (
      @timestamp, @request_id, @session_id, @provider, @model, @endpoint,
      @input_tokens, @output_tokens, @cost_usd, @loop_status, @blocked,
      @block_reason, @duration_ms, @http_status
    )
  `);

  insertSessionStmt = db.prepare(`
    INSERT OR IGNORE INTO sessions (session_id, created_at, last_call_at)
    VALUES (@session_id, @created_at, @last_call_at)
  `);

  updateSessionStmt = db.prepare(`
    UPDATE sessions
    SET total_calls = total_calls + 1,
        total_cost = total_cost + @cost,
        last_call_at = @last_call_at
    WHERE session_id = @session_id
  `);

  insertLoopEventStmt = db.prepare(`
    INSERT INTO loop_events (
      timestamp, session_id, layer, reason, calls_in_loop, estimated_savings_usd
    ) VALUES (
      @timestamp, @session_id, @layer, @reason, @calls_in_loop, @estimated_savings_usd
    )
  `);

  getDailySpendStmt = db.prepare(`
    SELECT SUM(cost_usd) as total
    FROM requests
    WHERE session_id = @session_id AND timestamp LIKE @datePattern
  `);

  getRecentRequestsStmt = db.prepare(`
    SELECT * FROM requests
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return db;
}

export function logRequest(data: RequestData): void {
  if (!db) return;
  insertRequestStmt.run({
    timestamp: new Date(data.timestamp).toISOString(),
    request_id: data.request_id,
    session_id: data.session_id,
    provider: data.provider,
    model: data.model,
    endpoint: data.endpoint,
    input_tokens: data.input_tokens,
    output_tokens: data.output_tokens,
    cost_usd: data.cost_usd,
    loop_status: data.loop_status,
    blocked: data.blocked ? 1 : 0,
    block_reason: data.block_reason || null,
    duration_ms: data.duration_ms,
    http_status: data.http_status
  });
}

export function logSessionStart(sessionId: string): void {
  if (!db) return;
  const now = new Date().toISOString();
  insertSessionStmt.run({
    session_id: sessionId,
    created_at: now,
    last_call_at: now
  });
}

export function updateSessionCost(sessionId: string, cost: number): void {
  if (!db) return;
  updateSessionStmt.run({
    session_id: sessionId,
    cost: cost,
    last_call_at: new Date().toISOString()
  });
}

export function logLoopEvent(
  sessionId: string,
  layer: number,
  reason: string,
  callsInLoop: number,
  savings: number
): void {
  if (!db) return;
  insertLoopEventStmt.run({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    layer: layer,
    reason: reason,
    calls_in_loop: callsInLoop,
    estimated_savings_usd: savings
  });
}

export function getDailySpend(sessionId: string, date?: string): number {
  if (!db) return 0;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const row = getDailySpendStmt.get({ 
    session_id: sessionId, 
    datePattern: `${targetDate}%` 
  }) as { total: number | null } | undefined;
  
  return row?.total || 0;
}

export function getRecentRequests(sessionId: string, limit: number): any[] {
  if (!db) return [];
  return getRecentRequestsStmt.all(sessionId, limit);
}
