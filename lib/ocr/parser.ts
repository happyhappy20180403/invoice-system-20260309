/**
 * OCR Text Parser
 * Extracts structured repair/invoice data from raw OCR text.
 *
 * Handles both clean text and noisy Tesseract output from scanned PDFs.
 */

export interface ParsedItem {
  date: string;
  project: string;
  unitNo: string;
  description: string;
  amount: number | null;
  confidence: number; // 0.0 - 1.0
  rawLine: string;
}

export interface ParseResult {
  items: ParsedItem[];
  rawText: string;
}

// -----------------------------------------------------------------------
// Known project names — includes abbreviations found in real repair lists
// -----------------------------------------------------------------------
const PROJECT_ALIASES: Record<string, string> = {
  'MOLEK PINE': 'MOLEK PINE',
  'MP4': 'MOLEK PINE 4',
  'MP3': 'MOLEK PINE 3',
  'MOLEK REGENCY': 'MOLEK REGENCY',
  'MOLEK TROPIKA': 'MOLEK TROPIKA',
  'MOLEK PULA': 'MOLEK PULAI',
  'MOLEK PULAI': 'MOLEK PULAI',
  'TAMAN MOLEK': 'TAMAN MOLEK',
  'SUASANA': 'SUASANA',
  'SUMMER PLACE': 'SUMMER PLACE',
  'PONDER OSA': 'PONDEROSA',
  'PONDEROSA': 'PONDEROSA',
  'IMPERIA': 'IMPERIA',
  'AUSTIN HEIGHTS': 'AUSTIN HEIGHTS',
  'BUKIT INDAH': 'BUKIT INDAH',
  'MOUNT AUSTIN': 'MOUNT AUSTIN',
  'KEMPAS INDAH': 'KEMPAS INDAH',
  'PUTERI HARBOUR': 'PUTERI HARBOUR',
  'SKUDAI PARADE': 'SKUDAI PARADE',
};

// Sorted by length descending so longer matches take priority
const PROJECT_KEYS = Object.keys(PROJECT_ALIASES).sort(
  (a, b) => b.length - a.length,
);

// -----------------------------------------------------------------------
// Patterns
// -----------------------------------------------------------------------

// Date: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
const DATE_PATTERNS = [
  /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
  /\b(\d{2})-(\d{2})-(\d{4})\b/,
  /\b(\d{2})\.(\d{2})\.(\d{4})\b/,
];

// Unit number: B-10-03, B-13A-06, 14-01, 33-12, etc.
const UNIT_PATTERN = /\b([A-Z]?-?\d{1,3}[A-Z]?-\d{2,3})\b/i;

// Amount: plain numbers (3+ digits), RM xxx, MYR xxx
const AMOUNT_PATTERNS = [
  /RM\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /MYR\s*([0-9,]+(?:\.\d{1,2})?)/i,
  // Standalone number that looks like money (at least 2 digits, possibly with decimals)
  /\b(\d{2,6}(?:\.\d{1,2})?)\b/,
];

// -----------------------------------------------------------------------
// Extraction helpers
// -----------------------------------------------------------------------

/** Normalize any date format to DD/MM/YYYY */
function normalizeDate(raw: string): string {
  // Already DD/MM/YYYY
  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (dmySlash) return raw;

  // DD-MM-YYYY → DD/MM/YYYY
  const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dmyDash) return `${dmyDash[1]}/${dmyDash[2]}/${dmyDash[3]}`;

  // DD.MM.YYYY → DD/MM/YYYY
  const dmyDot = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (dmyDot) return `${dmyDot[1]}/${dmyDot[2]}/${dmyDot[3]}`;

  // YYYY-MM-DD → DD/MM/YYYY
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  return raw;
}

function extractDate(line: string): { value: string; confidence: number } {
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      return { value: normalizeDate(match[0]), confidence: 0.9 };
    }
  }
  const d = new Date();
  return { value: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, confidence: 0.1 };
}

function extractProject(line: string): { value: string; confidence: number } {
  const upper = line.toUpperCase();
  for (const key of PROJECT_KEYS) {
    if (upper.includes(key)) {
      return { value: PROJECT_ALIASES[key], confidence: 0.95 };
    }
  }
  return { value: '', confidence: 0.0 };
}

function extractUnitNo(line: string): { value: string; confidence: number } {
  const match = UNIT_PATTERN.exec(line);
  if (match) {
    return { value: match[1].toUpperCase(), confidence: 0.9 };
  }
  return { value: '', confidence: 0.0 };
}

function extractAmount(line: string): { value: number | null; confidence: number } {
  // Try RM/MYR patterns first (high confidence)
  for (const pattern of AMOUNT_PATTERNS.slice(0, 2)) {
    const match = pattern.exec(line);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        return { value: num, confidence: 0.85 };
      }
    }
  }

  // Strip dates from the line first to avoid matching years as amounts
  let cleaned = line;
  for (const pattern of DATE_PATTERNS) {
    cleaned = cleaned.replace(new RegExp(pattern.source, 'g'), ' ');
  }
  // Strip date-like fragments (e.g. "040272025", "1110212026")
  cleaned = cleaned.replace(/\b\d{8,10}\b/g, ' ');
  // Strip unit numbers to avoid matching their digits as amounts (B-30-04 → 30)
  cleaned = cleaned.replace(UNIT_PATTERN, ' ');

  // Look for amount AFTER "internet banking" keyword — this is the primary amount column
  const bankingMatch = /internet\s+banking[^0-9]*(\d{1,6}(?:\.\d{1,2})?)/i.exec(cleaned);
  if (bankingMatch) {
    const num = parseFloat(bankingMatch[1]);
    if (!isNaN(num) && num >= 10 && num <= 99999) {
      return { value: num, confidence: 0.85 };
    }
  }

  // Fallback: collect standalone numbers, filter out years and noise
  const YEAR_VALUES = new Set([2024, 2025, 2026, 2027, 2028]);
  const amountCandidates: number[] = [];
  const numRegex = /\b(\d{2,6}(?:\.\d{1,2})?)\b/g;
  let m;
  while ((m = numRegex.exec(cleaned)) !== null) {
    const num = parseFloat(m[1]);
    if (num < 10 || num > 50000) continue;
    if (YEAR_VALUES.has(num)) continue;
    const ctx = cleaned.substring(Math.max(0, m.index - 2), m.index + m[0].length + 2);
    if (/\//.test(ctx)) continue;
    amountCandidates.push(num);
  }

  if (amountCandidates.length > 0) {
    return { value: amountCandidates[0], confidence: 0.6 };
  }

  return { value: null, confidence: 0.0 };
}

/**
 * Extract description by removing known fields from the line.
 */
function extractDescription(line: string): string {
  let desc = line;

  // Remove date patterns
  for (const pattern of DATE_PATTERNS) {
    desc = desc.replace(pattern, '');
  }

  // Remove unit number
  desc = desc.replace(UNIT_PATTERN, '');

  // Remove amount patterns (RM/MYR)
  for (const pattern of AMOUNT_PATTERNS.slice(0, 2)) {
    desc = desc.replace(pattern, '');
  }

  // Remove project names/abbreviations
  for (const key of PROJECT_KEYS) {
    desc = desc.replace(new RegExp(key, 'gi'), '');
  }

  // Remove common OCR noise
  desc = desc.replace(/internet\s*banking/gi, '');
  desc = desc.replace(/petty\s*cash/gi, '');
  desc = desc.replace(/\breceipt\b/gi, '');
  desc = desc.replace(/\bclaim\b/gi, '');
  desc = desc.replace(/\btenant\b/gi, '');

  // Remove table border artifacts and noise chars
  desc = desc.replace(/[|\[\]()~!{}©€¥★×]/g, ' ');
  // Remove standalone numbers (amounts, noise)
  desc = desc.replace(/\b\d{2,6}(?:\.\d{1,2})?\b/g, ' ');

  // Clean up
  desc = desc.replace(/[,;:\-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase();
  }

  return desc;
}

function computeConfidence(
  dateConf: number,
  projectConf: number,
  unitConf: number,
  amountConf: number,
): number {
  const weights = [
    { conf: dateConf, weight: 0.15 },
    { conf: projectConf, weight: 0.30 },
    { conf: unitConf, weight: 0.30 },
    { conf: amountConf, weight: 0.25 },
  ];
  return weights.reduce((acc, w) => acc + w.conf * w.weight, 0);
}

function isDataLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return false;
  return true;
}

/**
 * Merge multi-line OCR entries.
 * Tesseract often splits table rows across lines:
 *   Line 1: "03/02/2026 | SUASANA | 14-01"
 *   Line 2: "REPLACEMENT REPAIR  internet banking  2600"
 *
 * This function merges continuation lines into the preceding data line.
 */
function mergeMultiLineEntries(lines: string[]): string[] {
  const merged: string[] = [];

  for (const line of lines) {
    if (!isDataLine(line)) continue;

    const hasDate = DATE_PATTERNS.some(p => p.test(line));
    const hasUnit = UNIT_PATTERN.test(line);

    if (hasDate || hasUnit) {
      // Start of a new entry
      merged.push(line.trim());
    } else if (merged.length > 0) {
      // Continuation of previous entry — append
      merged[merged.length - 1] += ' ' + line.trim();
    }
  }

  return merged;
}

/**
 * Parse raw OCR text into structured repair/invoice items.
 */
export function parseOcrText(rawText: string): ParseResult {
  const rawLines = rawText.split('\n');
  const mergedLines = mergeMultiLineEntries(rawLines);

  const items: ParsedItem[] = [];

  // Collect global context (date, project) from first pass
  const _d = new Date();
  let globalDate = `${String(_d.getDate()).padStart(2, '0')}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
  let globalProject = '';

  for (const line of mergedLines) {
    const dateResult = extractDate(line);
    if (dateResult.confidence > 0.5 && !globalDate) {
      globalDate = dateResult.value;
    }
    const projectResult = extractProject(line);
    if (projectResult.confidence > 0.4 && !globalProject) {
      globalProject = projectResult.value;
    }
  }

  // Second pass: extract items
  for (const line of mergedLines) {
    const unitResult = extractUnitNo(line);
    if (unitResult.confidence < 0.5) continue;

    const dateResult = extractDate(line);
    const projectResult = extractProject(line);
    const amountResult = extractAmount(line);
    const description = extractDescription(line);

    const date = dateResult.confidence > 0.5 ? dateResult.value : globalDate;
    const project =
      projectResult.confidence > 0.4 ? projectResult.value : globalProject;

    const confidence = computeConfidence(
      dateResult.confidence > 0.5 ? dateResult.confidence : 0.3,
      project
        ? projectResult.confidence > 0.4
          ? projectResult.confidence
          : 0.3
        : 0.0,
      unitResult.confidence,
      amountResult.confidence,
    );

    items.push({
      date,
      project,
      unitNo: unitResult.value,
      description: description || 'Repair/Maintenance',
      amount: amountResult.value,
      confidence: Math.round(confidence * 100) / 100,
      rawLine: line.trim().substring(0, 200),
    });
  }

  return { items, rawText };
}
