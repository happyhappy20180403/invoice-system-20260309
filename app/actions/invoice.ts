'use server';

import { auth } from '@/lib/auth';
import {
  createXeroInvoice,
  createXeroCreditNote,
  type XeroInvoicePayload,
  type XeroCreditNotePayload,
} from '@/lib/xero/xero-service';
import { db } from '@/lib/db';
import { createdInvoices } from '@/lib/db/schema';
import { z } from 'zod';

// Map display names to Xero API tax type codes
const TAX_TYPE_MAP: Record<string, string> = {
  'Tax Exempt': 'NONE',
  'tax exempt': 'NONE',
  'Tax Exempt (0%)': 'NONE',
  'No Tax': 'NONE',
  'Tax on Sales': 'OUTPUT',
  'Tax on Purchases': 'INPUT',
  'Service Tax': 'TAX002',
  'SST 8%': 'TAX003',
};

function resolveXeroTaxType(displayName: string): string {
  return TAX_TYPE_MAP[displayName] ?? displayName;
}

const InvoiceFormSchema = z.object({
  date: z.string().min(1),
  dueDate: z.string().min(1),
  project: z.string().min(1),
  unitNo: z.string().min(1),
  description: z.string().min(1),
  finalPrice: z.number().positive(),
  contactName: z.string().min(1),
  accountCode: z.string().min(1),
  taxType: z.string().min(1),
  invoiceType: z.string().default('ACCREC'),
  trackingOption1: z.string().optional(),
  trackingOption2: z.string().optional(),
  reference: z.string().optional(),
  quantity: z.number().default(1),
  unitAmount: z.number().optional(),
});

export type InvoiceFormData = z.infer<typeof InvoiceFormSchema>;

export async function createInvoiceAction(formData: InvoiceFormData) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = InvoiceFormSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const xeroUserId = (session as any).xeroUserId;

  const tracking: Array<{ Name: string; Option: string }> = [];
  if (data.trackingOption1) {
    tracking.push({ Name: 'NATURE OF ACCOUNT', Option: data.trackingOption1 });
  }
  if (data.trackingOption2) {
    tracking.push({ Name: 'Categories/Projects', Option: data.trackingOption2 });
  }

  const payload: XeroInvoicePayload = {
    Type: 'ACCREC',
    Contact: { Name: data.contactName },
    Date: data.date,
    DueDate: data.dueDate,
    LineItems: [
      {
        Description: data.description,
        Quantity: data.quantity,
        UnitAmount: data.unitAmount ?? data.finalPrice / data.quantity,
        AccountCode: data.accountCode,
        TaxType: resolveXeroTaxType(data.taxType),
        ...(tracking.length > 0 ? { Tracking: tracking } : {}),
      },
    ],
    Reference: data.reference,
    Status: 'DRAFT',
    LineAmountTypes: 'Exclusive',
  };

  console.log('[Invoice] Payload:', JSON.stringify(payload, null, 2));

  try {
    const result = await createXeroInvoice(xeroUserId, payload);

    // Audit log
    db.insert(createdInvoices).values({
      xeroInvoiceId: result.InvoiceID,
      invoiceNumber: result.InvoiceNumber,
      contactName: data.contactName,
      project: data.project,
      unitNo: data.unitNo,
      description: data.description,
      totalAmount: data.finalPrice,
      status: 'DRAFT',
      createdBy: session.user?.email ?? xeroUserId,
      rawPayload: JSON.stringify(payload),
    }).run();

    return {
      success: true,
      invoiceId: result.InvoiceID,
      invoiceNumber: result.InvoiceNumber,
    };
  } catch (error) {
    console.error('Invoice creation failed:', error);
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Credit Note Action
// ---------------------------------------------------------------------------

const CreditNoteFormSchema = z.object({
  date: z.string().min(1),
  project: z.string().min(1),
  unitNo: z.string().min(1),
  description: z.string().min(1),
  finalPrice: z.number().positive(),
  contactName: z.string().min(1),
  accountCode: z.string().min(1),
  taxType: z.string().min(1),
  reference: z.string().optional(),
  quantity: z.number().default(1),
  unitAmount: z.number().optional(),
});

export type CreditNoteFormData = z.infer<typeof CreditNoteFormSchema>;

export async function createCreditNoteAction(formData: CreditNoteFormData) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CreditNoteFormSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const xeroUserId = (session as any).xeroUserId;

  const payload: XeroCreditNotePayload = {
    Type: 'ACCRECCREDIT',
    Contact: { Name: data.contactName },
    Date: data.date,
    LineItems: [
      {
        Description: data.description,
        Quantity: data.quantity,
        UnitAmount: data.unitAmount ?? data.finalPrice / data.quantity,
        AccountCode: data.accountCode,
        TaxType: data.taxType,
      },
    ],
    Reference: data.reference,
    Status: 'DRAFT',
  };

  try {
    const result = await createXeroCreditNote(xeroUserId, payload);

    // Audit log (reuse createdInvoices table with status indicator)
    db.insert(createdInvoices)
      .values({
        xeroInvoiceId: result.CreditNoteID,
        invoiceNumber: result.CreditNoteNumber,
        contactName: data.contactName,
        project: data.project,
        unitNo: data.unitNo,
        description: data.description,
        totalAmount: data.finalPrice,
        status: 'DRAFT_CREDIT',
        createdBy: session.user?.email ?? xeroUserId,
        rawPayload: JSON.stringify(payload),
      })
      .run();

    return {
      success: true,
      creditNoteId: result.CreditNoteID,
      creditNoteNumber: result.CreditNoteNumber,
    };
  } catch (error) {
    console.error('Credit note creation failed:', error);
    return { success: false, error: String(error) };
  }
}
