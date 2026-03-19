import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'invoice.db');
const CSV_BASE = 'C:/Users/ryoku/Downloads/Invoice';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS invoice_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT,
    contact_name TEXT,
    email_address TEXT,
    project TEXT,
    unit_no TEXT,
    description TEXT,
    account_code TEXT,
    tax_type TEXT,
    tracking_option1 TEXT,
    tracking_option2 TEXT,
    reference TEXT,
    invoice_type TEXT,
    invoice_date TEXT,
    due_date TEXT,
    total REAL,
    unit_amount REAL,
    quantity REAL,
    sa_address_line1 TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO invoice_history (
    invoice_number, contact_name, email_address, project, unit_no,
    description, account_code, tax_type, tracking_option1, tracking_option2,
    reference, invoice_type, invoice_date, due_date, total, unit_amount,
    quantity, sa_address_line1
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

function extractProjectAndUnit(contactName: string): { project: string; unitNo: string } {
  // ContactName format: "PROJECT UNIT (O)Owner" or "PROJECT UNIT Owner"
  if (!contactName) return { project: '', unitNo: '' };

  // Remove owner part
  const parts = contactName.split(/\s*\(O\)\s*/);
  const prefix = parts[0].trim();

  // Split by spaces - first 1-2 words are project, last word with dash/number is unit
  const words = prefix.split(/\s+/);
  if (words.length === 0) return { project: '', unitNo: '' };

  // Try to find unit number pattern (contains dash or is mostly digits)
  let unitIdx = -1;
  for (let i = words.length - 1; i >= 1; i--) {
    if (/[-\d]/.test(words[i]) && words[i].length <= 10) {
      unitIdx = i;
      break;
    }
  }

  if (unitIdx > 0) {
    return {
      project: words.slice(0, unitIdx).join(' '),
      unitNo: words[unitIdx],
    };
  }

  return { project: prefix, unitNo: '' };
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  // Format: DD/MM/YYYY -> YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}

function importCsvFile(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  let count = 0;
  for (const row of records as Record<string, string>[]) {
    const contactName = row['ContactName'] || row['*ContactName'] || '';
    const { project, unitNo } = extractProjectAndUnit(contactName);

    insert.run(
      row['InvoiceNumber'] || '',
      contactName,
      row['EmailAddress'] || '',
      project,
      unitNo,
      row['Description'] || '',
      row['AccountCode'] || '',
      row['*TaxType'] || row['TaxType'] || '',
      row['TrackingOption1'] || '',
      row['TrackingOption2'] || '',
      row['Reference'] || '',
      row['*InvoiceType'] || row['InvoiceType'] || '',
      parseDate(row['*InvoiceDate'] || row['InvoiceDate'] || ''),
      parseDate(row['*DueDate'] || row['DueDate'] || ''),
      parseFloat(row['Total'] || '0') || 0,
      parseFloat(row['*UnitAmount'] || row['UnitAmount'] || '0') || 0,
      parseFloat(row['*Quantity'] || row['Quantity'] || '1') || 1,
      row['SAAddressLine1'] || '',
    );
    count++;
  }
  return count;
}

// Scan all CSV directories
const dirs = ['inv2023', 'inv2024', 'inv2025'];
let totalRecords = 0;

for (const dir of dirs) {
  const dirPath = path.join(CSV_BASE, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Skipping ${dir} (not found)`);
    continue;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
  console.log(`Processing ${dir}: ${files.length} files`);

  const insertMany = db.transaction(() => {
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const count = importCsvFile(filePath);
        totalRecords += count;
        console.log(`  ${file}: ${count} records`);
      } catch (e) {
        console.error(`  ${file}: ERROR - ${e}`);
      }
    }
  });

  insertMany();
}

console.log(`\nTotal records imported: ${totalRecords}`);

// Also create other tables
db.exec(`
  CREATE TABLE IF NOT EXISTS xero_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE,
    tenant_id TEXT,
    tenant_name TEXT,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id TEXT UNIQUE,
    contact_name TEXT,
    email_address TEXT,
    is_customer INTEGER,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS account_code_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    description TEXT,
    tax_type TEXT,
    account_type TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS created_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xero_invoice_id TEXT UNIQUE,
    invoice_number TEXT,
    contact_name TEXT,
    project TEXT,
    unit_no TEXT,
    description TEXT,
    total_amount REAL,
    status TEXT DEFAULT 'DRAFT',
    created_by TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    raw_payload TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

console.log('All tables created successfully.');
db.close();
