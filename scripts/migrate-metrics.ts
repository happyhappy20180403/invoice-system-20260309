/**
 * migrate-metrics.ts
 *
 * Creates api_metrics and system_metrics tables if they do not exist.
 * Run with: npx tsx scripts/migrate-metrics.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'invoice.db');
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite
  .prepare(
    `CREATE TABLE IF NOT EXISTS api_metrics (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint         TEXT,
      method           TEXT,
      status_code      INTEGER,
      response_time_ms INTEGER,
      error_message    TEXT,
      timestamp        INTEGER DEFAULT (unixepoch())
    )`,
  )
  .run();

sqlite
  .prepare(
    `CREATE TABLE IF NOT EXISTS system_metrics (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name  TEXT,
      metric_value REAL,
      metadata     TEXT,
      timestamp    INTEGER DEFAULT (unixepoch())
    )`,
  )
  .run();

console.log('Metrics tables created (or already exist).');
sqlite.close();
