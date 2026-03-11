'use server';

import { auth } from '@/lib/auth';
import { createXeroInvoice, type XeroInvoicePayload } from '@/lib/xero/xero-service';
import { db } from '@/lib/db';
import { createdInvoices } from '@/lib/db/schema';
import { z } from 'zod';

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
    tracking.push({ Name: 'TrackingOption1', Option: data.trackingOption1 });
  }
  if (data.trackingOption2) {
    tracking.push({ Name: 'TrackingOption2', Option: data.trackingOption2 });
  }

  const payload: XeroInvoicePayload = {
    Type: data.invoiceType,
    Contact: { Name: data.contactName },
    Date: data.date,
    DueDate: data.dueDate,
    LineItems: [
      {
        Description: data.description,
        Quantity: data.quantity,
        UnitAmount: data.unitAmount ?? data.finalPrice / data.quantity,
        AccountCode: data.accountCode,
        TaxType: data.taxType,
        ...(tracking.length > 0 ? { Tracking: tracking } : {}),
      },
    ],
    Reference: data.reference,
    Status: 'DRAFT',
    LineAmountTypes: 'Exclusive',
  };

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
