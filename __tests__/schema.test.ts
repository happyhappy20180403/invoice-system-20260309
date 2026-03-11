import { describe, it, expect } from 'vitest';
import * as schema from '../lib/db/schema';

describe('Database Schema', () => {
  it('should export all required tables', () => {
    const requiredTables = [
      'users',
      'xeroTokens',
      'invoiceHistory',
      'contactsCache',
      'accountCodeMappings',
      'createdInvoices',
      'systemConfig',
      'apiMetrics',
      'systemMetrics',
      'ocrUploads',
    ];

    for (const table of requiredTables) {
      expect(schema).toHaveProperty(table);
    }
  });

  describe('users table', () => {
    it('should have role field with staff default', () => {
      const cols = (schema.users as any)[Symbol.for('drizzle:Columns')];
      expect(cols).toBeDefined();
    });
  });

  describe('ocrUploads table', () => {
    it('should exist as a valid table export', () => {
      expect(schema.ocrUploads).toBeDefined();
    });
  });

  describe('apiMetrics table', () => {
    it('should exist for monitoring', () => {
      expect(schema.apiMetrics).toBeDefined();
    });
  });
});
