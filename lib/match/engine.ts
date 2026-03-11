import Fuse from 'fuse.js';
import { db } from '@/lib/db';
import { invoiceHistory, contactsCache, accountCodeMappings } from '@/lib/db/schema';
import { like } from 'drizzle-orm';

interface HistoryRecord {
  id: number;
  contactName: string | null;
  project: string | null;
  unitNo: string | null;
  description: string | null;
  accountCode: string | null;
  taxType: string | null;
  trackingOption1: string | null;
  trackingOption2: string | null;
  emailAddress: string | null;
  reference: string | null;
  invoiceType: string | null;
  unitAmount: number | null;
  quantity: number | null;
}

export interface MatchResult {
  contactName: string;
  emailAddress: string;
  accountCode: string;
  taxType: string;
  trackingOption1: string;
  trackingOption2: string;
  reference: string;
  invoiceType: string;
  unitAmount: number;
  quantity: number;
  score: number;
}

let fuseIndex: Fuse<HistoryRecord> | null = null;

export function buildIndex(): void {
  const records = db.select().from(invoiceHistory).all();
  fuseIndex = new Fuse(records, {
    keys: [
      { name: 'project', weight: 2.0 },
      { name: 'unitNo', weight: 1.5 },
      { name: 'description', weight: 1.0 },
      { name: 'contactName', weight: 0.8 },
    ],
    threshold: 0.4,
    includeScore: true,
    shouldSort: true,
  });
}

export function fuzzyMatch(
  project: string,
  unitNo: string,
  description: string,
): MatchResult[] {
  if (!fuseIndex) buildIndex();

  const query = [project, unitNo, description].filter(Boolean).join(' ');
  const results = fuseIndex!.search(query, { limit: 10 });

  return results.map(r => ({
    contactName: r.item.contactName ?? '',
    emailAddress: r.item.emailAddress ?? '',
    accountCode: r.item.accountCode ?? '',
    taxType: r.item.taxType ?? '',
    trackingOption1: r.item.trackingOption1 ?? '',
    trackingOption2: r.item.trackingOption2 ?? '',
    reference: r.item.reference ?? '',
    invoiceType: r.item.invoiceType ?? 'ACCREC',
    unitAmount: r.item.unitAmount ?? 0,
    quantity: r.item.quantity ?? 1,
    score: 1 - (r.score ?? 1),
  }));
}

export function getContacts(search?: string) {
  if (search) {
    return db.select().from(contactsCache)
      .where(like(contactsCache.contactName, `%${search}%`))
      .limit(20)
      .all();
  }
  return db.select().from(contactsCache).limit(100).all();
}

export function getAccountCodes() {
  return db.select().from(accountCodeMappings).all();
}

export function getTrackingOptions(): { option1: string[]; option2: string[] } {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'data', 'tracking_options.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      option1: data.TrackingOption1?.map((o: any) => o.Name || o) ?? [],
      option2: data.TrackingOption2?.map((o: any) => o.Name || o) ?? [],
    };
  } catch {
    return { option1: [], option2: [] };
  }
}
