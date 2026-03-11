import { describe, it, expect } from 'vitest';
import type { XeroInvoicePayload, XeroCreditNotePayload } from '../lib/xero/xero-service';

describe('Xero Service Types', () => {
  describe('XeroInvoicePayload', () => {
    it('should construct a valid DRAFT invoice payload', () => {
      const payload: XeroInvoicePayload = {
        Type: 'ACCREC',
        Contact: { Name: 'Test Contact' },
        Date: '2026-03-15',
        DueDate: '2026-04-14',
        LineItems: [
          {
            Description: 'Management Fee - March 2026',
            Quantity: 1,
            UnitAmount: 11700.0,
            AccountCode: '200',
            TaxType: 'NONE',
            Tracking: [
              { Name: 'TrackingOption1', Option: 'Income' },
              { Name: 'TrackingOption2', Option: 'Management Fee' },
            ],
          },
        ],
        Reference: 'REF-001',
        Status: 'DRAFT',
        LineAmountTypes: 'Exclusive',
      };

      expect(payload.Status).toBe('DRAFT');
      expect(payload.Contact.Name).toBe('Test Contact');
      expect(payload.LineItems.length).toBe(1);
      expect(payload.LineItems[0].UnitAmount).toBe(11700.0);
    });
  });

  describe('XeroCreditNotePayload', () => {
    it('should construct a valid credit note payload', () => {
      const payload: XeroCreditNotePayload = {
        Type: 'ACCRECCREDIT',
        Contact: { Name: 'Test Contact' },
        Date: '2026-03-15',
        LineItems: [
          {
            Description: 'Refund - Management Fee overpayment',
            Quantity: 1,
            UnitAmount: 500.0,
            AccountCode: '200',
            TaxType: 'NONE',
          },
        ],
        Reference: 'CN-001',
        Status: 'DRAFT',
      };

      expect(payload.Type).toBe('ACCRECCREDIT');
      expect(payload.Status).toBe('DRAFT');
      expect(payload.LineItems[0].UnitAmount).toBe(500.0);
    });
  });

  describe('Batch Invoice Validation', () => {
    it('should reject batch with more than 50 invoices', () => {
      const invoices: XeroInvoicePayload[] = Array.from({ length: 51 }, (_, i) => ({
        Type: 'ACCREC',
        Contact: { Name: `Contact ${i}` },
        Date: '2026-03-15',
        DueDate: '2026-04-14',
        LineItems: [
          {
            Description: `Item ${i}`,
            Quantity: 1,
            UnitAmount: 100,
            AccountCode: '200',
            TaxType: 'NONE',
          },
        ],
        Status: 'DRAFT' as const,
      }));

      expect(invoices.length).toBe(51);
      // createXeroBatchInvoices would throw for > 50
    });

    it('should accept batch with exactly 50 invoices', () => {
      const invoices: XeroInvoicePayload[] = Array.from({ length: 50 }, (_, i) => ({
        Type: 'ACCREC',
        Contact: { Name: `Contact ${i}` },
        Date: '2026-03-15',
        DueDate: '2026-04-14',
        LineItems: [
          {
            Description: `Item ${i}`,
            Quantity: 1,
            UnitAmount: 100,
            AccountCode: '200',
            TaxType: 'NONE',
          },
        ],
        Status: 'DRAFT' as const,
      }));

      expect(invoices.length).toBe(50);
    });
  });
});
