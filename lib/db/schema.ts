import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  name: text('name'),
  role: text('role').notNull().default('staff'), // 'admin' | 'accountant' | 'staff'
  xeroUserId: text('xero_user_id'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const xeroTokens = sqliteTable('xero_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').unique(),
  tenantId: text('tenant_id'),
  tenantName: text('tenant_name'),
  encryptedAccessToken: text('encrypted_access_token'),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  expiresAt: integer('expires_at'),
  refreshTokenExpiresAt: integer('refresh_token_expires_at'),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const invoiceHistory = sqliteTable('invoice_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number'),
  contactName: text('contact_name'),
  emailAddress: text('email_address'),
  project: text('project'),
  unitNo: text('unit_no'),
  description: text('description'),
  accountCode: text('account_code'),
  taxType: text('tax_type'),
  trackingOption1: text('tracking_option1'),
  trackingOption2: text('tracking_option2'),
  reference: text('reference'),
  invoiceType: text('invoice_type'),
  invoiceDate: text('invoice_date'),
  dueDate: text('due_date'),
  total: real('total'),
  unitAmount: real('unit_amount'),
  quantity: real('quantity'),
  saAddressLine1: text('sa_address_line1'),
});

export const contactsCache = sqliteTable('contacts_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: text('contact_id').unique(),
  contactName: text('contact_name'),
  emailAddress: text('email_address'),
  isCustomer: integer('is_customer', { mode: 'boolean' }),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const accountCodeMappings = sqliteTable('account_code_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique(),
  name: text('name'),
  description: text('description'),
  taxType: text('tax_type'),
  accountType: text('account_type'),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const createdInvoices = sqliteTable('created_invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  xeroInvoiceId: text('xero_invoice_id').unique(),
  invoiceNumber: text('invoice_number'),
  contactName: text('contact_name'),
  project: text('project'),
  unitNo: text('unit_no'),
  description: text('description'),
  totalAmount: real('total_amount'),
  status: text('status').default('DRAFT'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  rawPayload: text('raw_payload'),
});

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const apiMetrics = sqliteTable('api_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  endpoint: text('endpoint'),
  method: text('method'),
  statusCode: integer('status_code'),
  responseTimeMs: integer('response_time_ms'),
  errorMessage: text('error_message'),
  timestamp: integer('timestamp').default(sql`(unixepoch())`),
});

export const systemMetrics = sqliteTable('system_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  metricName: text('metric_name'),
  metricValue: real('metric_value'),
  metadata: text('metadata'),
  timestamp: integer('timestamp').default(sql`(unixepoch())`),
});

export const ocrUploads = sqliteTable('ocr_uploads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename'),
  fileType: text('file_type'),
  rawText: text('raw_text'),
  parsedData: text('parsed_data'),
  status: text('status').default('pending'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});
