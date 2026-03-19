import Fuse from 'fuse.js';
import { db } from '@/lib/db';
import { invoiceHistory, contactsCache, accountCodeMappings } from '@/lib/db/schema';
import { like, and, eq } from 'drizzle-orm';

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

// Common project name aliases (full name → DB abbreviation)
const PROJECT_ALIASES: Record<string, string[]> = {
  'MOLEK PINE 4': ['MP4'],
  'MOLEK PINE 3': ['MP3'],
  'MOLEK PINE': ['MP4', 'MP3'],
  'SUMMER PLACE': ['V@Summerplace'],
  'SUMMERPLACE': ['V@Summerplace'],
  'PONDEROSA GREEN': ['Ponderosa Green', 'Ponderosa Green No.', 'PONDEROSA GREEN NO.'],
};

function resolveProjectNames(input: string): string[] {
  const upper = input.toUpperCase();
  const results = [input];
  for (const [alias, dbNames] of Object.entries(PROJECT_ALIASES)) {
    if (upper === alias.toUpperCase() || upper.includes(alias.toUpperCase())) {
      results.push(...dbNames);
    }
  }
  return [...new Set(results)];
}

function normalizeUnit(u: string): string {
  return u.replace(/\s+/g, '').toUpperCase();
}

function toResult(item: HistoryRecord, score: number): MatchResult {
  return {
    contactName: item.contactName ?? '',
    emailAddress: item.emailAddress ?? '',
    accountCode: item.accountCode ?? '',
    taxType: item.taxType ?? '',
    trackingOption1: item.trackingOption1 ?? '',
    trackingOption2: item.trackingOption2 ?? '',
    reference: item.reference ?? '',
    invoiceType: item.invoiceType ?? 'ACCREC',
    unitAmount: item.unitAmount ?? 0,
    quantity: item.quantity ?? 1,
    score,
  };
}

export function fuzzyMatch(
  project: string,
  unitNo: string,
  description: string,
): MatchResult[] {
  if (!fuseIndex) buildIndex();

  console.log('[Match] Input:', { project, unitNo, description });

  // Phase 1: Try project + unit match via SQL (handles B-28-07 vs B1-28-07)
  if (project && unitNo) {
    // Strip leading "B" prefix variations: B-28-07 → 28-07, B1-28-07 → 28-07
    const coreUnit = unitNo.replace(/^B\d?-/i, '');

    // Resolve project aliases (MOLEK PINE 4 → MP4, etc.)
    const resolvedProjects = resolveProjectNames(project);
    const projKeywords = project.split(/[\s@]+/).filter(w => w.length >= 2);

    const projectFilters = [
      // Try resolved aliases first (highest priority)
      ...resolvedProjects.map(p => eq(invoiceHistory.project, p)),
      // Then LIKE searches
      like(invoiceHistory.project, `%${project.replace(/\s+/g, '%')}%`),
      // Try each keyword individually
      ...projKeywords.map(kw => like(invoiceHistory.project, `%${kw}%`)),
    ];

    let candidates: HistoryRecord[] = [];
    for (const projFilter of projectFilters) {
      candidates = db.select().from(invoiceHistory)
        .where(and(projFilter, like(invoiceHistory.unitNo, `%${coreUnit}`)))
        .all();
      if (candidates.length > 0) break;
    }

    // If still no match, try unit-only (no project filter)
    if (candidates.length === 0) {
      candidates = db.select().from(invoiceHistory)
        .where(like(invoiceHistory.unitNo, `%${coreUnit}`))
        .limit(50)
        .all();
    }

    console.log('[Match] Phase 1 candidates:', candidates.length, 'coreUnit:', coreUnit);

    if (candidates.length > 0) {
      // Phase 1a: If description looks like a repair, prefer REPAIR records
      const isRepairQuery = /repair|light|aircon|aircond|pipe|door|lock|fan|toilet|pump|cabinet|window|ceiling|wiring|socket/i.test(description);
      let pool = candidates;
      // Prefer matching transaction type: REPAIR → IN-REP records, REQUESTED → IN-REQ records
      const isRequestedQuery = /request(ed)?\s*item/i.test(description);
      if (isRequestedQuery) {
        const reqOnly = candidates.filter(r => /requested?\s*item/i.test(r.description ?? ''));
        if (reqOnly.length > 0) pool = reqOnly;
      } else if (isRepairQuery) {
        const repairOnly = candidates.filter(r => /repair/i.test(r.description ?? ''));
        if (repairOnly.length > 0) pool = repairOnly;
      }

      // Among pool, rank by description similarity
      const descFuse = new Fuse(pool, {
        keys: [{ name: 'description', weight: 1.0 }],
        threshold: 0.8,
        includeScore: true,
        shouldSort: true,
      });
      const descQuery = description || '';
      const ranked = descQuery ? descFuse.search(descQuery, { limit: 10 }) : [];
      if (ranked.length > 0) {
        return ranked.map(r => toResult(r.item, 1 - (r.score ?? 1)));
      }
      // Fallback: return repair records first if available
      return pool.slice(0, 10).map(r => toResult(r, 0.8));
    }
  }

  // Phase 2: Fallback to full fuzzy search with relaxed threshold
  const query = [project, unitNo, description].filter(Boolean).join(' ');
  const results = fuseIndex!.search(query, { limit: 10 });

  console.log('[Match] Phase 2 results:', results.length, results.slice(0, 2).map(r => ({ score: r.score, contact: r.item.contactName })));

  return results.map(r => toResult(r.item, 1 - (r.score ?? 1)));
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
