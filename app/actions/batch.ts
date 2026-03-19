'use server';

import { auth } from '@/lib/auth';
import { fuzzyMatch, type MatchResult } from '@/lib/match/engine';
import { createXeroBatchInvoices, type XeroInvoicePayload } from '@/lib/xero/xero-service';
import { db } from '@/lib/db';
import { createdInvoices } from '@/lib/db/schema';

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

export interface BatchRow {
  date: string;
  project: string;
  unitNo: string;
  description: string;
  finalPrice: number;
}

export interface BatchRowWithMatch extends BatchRow {
  rowIndex: number;
  matches: MatchResult[];
  // Fields from best match, user-editable
  contactName: string;
  accountCode: string;
  taxType: string;
  invoiceType: string;
  trackingOption1: string;
  trackingOption2: string;
  reference: string;
  quantity: number;
  dueDate: string;
  score: number;
}

export interface BatchSubmitResult {
  rowIndex: number;
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

// batchMatchAction: 複数行を一括ファジー検索
export async function batchMatchAction(rows: BatchRow[]): Promise<BatchRowWithMatch[]> {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return rows.map((row, idx) => {
    const matches = fuzzyMatch(row.project, row.unitNo, row.description);
    const best = matches[0];

    const dueDate = new Date(row.date);
    dueDate.setMonth(dueDate.getMonth() + 1, 0); // last day of same month

    return {
      ...row,
      rowIndex: idx,
      matches,
      contactName: best?.contactName ?? '',
      accountCode: best?.accountCode ?? '',
      taxType: best?.taxType ?? 'NONE',
      invoiceType: best?.invoiceType ?? 'ACCREC',
      trackingOption1: best?.trackingOption1 ?? '',
      trackingOption2: best?.trackingOption2 ?? '',
      reference: best?.reference ?? '',
      quantity: best?.quantity ?? 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      score: best?.score ?? 0,
    };
  });
}

// batchCreateInvoicesAction: 最大50件ずつXero APIに送信
export async function batchCreateInvoicesAction(
  rows: BatchRowWithMatch[],
  selectedIndices?: number[],
): Promise<BatchSubmitResult[]> {
  const session = await auth();
  if (!session?.user) {
    return [{ rowIndex: -1, success: false, error: 'Unauthorized' }];
  }

  const xeroUserId = (session as any).xeroUserId;
  const targetRows = selectedIndices
    ? rows.filter(r => selectedIndices.includes(r.rowIndex))
    : rows;

  const results: BatchSubmitResult[] = [];

  // 50件ずつチャンクに分けて送信
  const CHUNK_SIZE = 50;
  for (let i = 0; i < targetRows.length; i += CHUNK_SIZE) {
    const chunk = targetRows.slice(i, i + CHUNK_SIZE);

    const payloads: XeroInvoicePayload[] = chunk.map(row => {
      const tracking: Array<{ Name: string; Option: string }> = [];
      if (row.trackingOption1) {
        tracking.push({ Name: 'NATURE OF ACCOUNT', Option: row.trackingOption1 });
      }
      if (row.trackingOption2) {
        tracking.push({ Name: 'Categories/Projects', Option: row.trackingOption2 });
      }

      return {
        Type: 'ACCREC',
        Contact: { Name: row.contactName },
        Date: row.date,
        DueDate: row.dueDate,
        LineItems: [
          {
            Description: row.description,
            Quantity: row.quantity,
            UnitAmount: row.finalPrice / row.quantity,
            AccountCode: row.accountCode,
            TaxType: resolveXeroTaxType(row.taxType),
            ...(tracking.length > 0 ? { Tracking: tracking } : {}),
          },
        ],
        Reference: row.reference || undefined,
        Status: 'DRAFT',
        LineAmountTypes: 'Exclusive',
      };
    });

    try {
      const createdList = await createXeroBatchInvoices(xeroUserId, payloads);

      // 成功した行をAudit logに記録し、結果を収集
      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const created = createdList[j];

        if (created && created.InvoiceID) {
          try {
            db.insert(createdInvoices).values({
              xeroInvoiceId: created.InvoiceID,
              invoiceNumber: created.InvoiceNumber ?? null,
              contactName: row.contactName,
              project: row.project,
              unitNo: row.unitNo,
              description: row.description,
              totalAmount: row.finalPrice,
              status: 'DRAFT',
              createdBy: session.user?.email ?? xeroUserId,
              rawPayload: JSON.stringify(payloads[j]),
            }).run();
          } catch (dbError) {
            console.error('Audit log failed for row', row.rowIndex, dbError);
          }

          results.push({
            rowIndex: row.rowIndex,
            success: true,
            invoiceId: created.InvoiceID,
            invoiceNumber: created.InvoiceNumber ?? '',
          });
        } else {
          results.push({
            rowIndex: row.rowIndex,
            success: false,
            error: 'No InvoiceID returned from Xero',
          });
        }
      }
    } catch (error) {
      // チャンク全体が失敗した場合、各行にエラーを記録
      for (const row of chunk) {
        results.push({
          rowIndex: row.rowIndex,
          success: false,
          error: String(error),
        });
      }
    }
  }

  return results;
}
