import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'invoice.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    xero_user_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS api_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT,
    method TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    timestamp INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT,
    metric_value REAL,
    metadata TEXT,
    timestamp INTEGER DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS ocr_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    file_type TEXT,
    raw_text TEXT,
    parsed_data TEXT,
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`,
];

console.log('Running migrations...');
for (const sql of migrations) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  try {
    db.exec(sql);
    console.log(`  ✓ ${tableName}`);
  } catch (e: any) {
    console.log(`  ⚠ ${tableName}: ${e.message}`);
  }
}
console.log('Done!');
db.close();
