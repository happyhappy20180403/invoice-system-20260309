/**
 * OCR Text Parser
 * Extracts structured repair/invoice data from raw OCR text.
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

// Known project names for fuzzy matching
const KNOWN_PROJECTS = [
  'MOLEK PINE',
  'MOLEK REGENCY',
  'MOLEK TROPIKA',
  'TAMAN MOLEK',
  'SKUDAI PARADE',
  'AUSTIN HEIGHTS',
  'BUKIT INDAH',
  'MOUNT AUSTIN',
  'KEMPAS INDAH',
  'PUTERI HARBOUR',
];

// Date patterns: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
const DATE_PATTERNS = [
  /\b(\d{2})\/(\d{2})\/(\d{4})\b/,    // DD/MM/YYYY
  /\b(\d{4})-(\d{2})-(\d{2})\b/,      // YYYY-MM-DD
  /\b(\d{2})-(\d{2})-(\d{4})\b/,      // DD-MM-YYYY
  /\b(\d{2})\.(\d{2})\.(\d{4})\b/,    // DD.MM.YYYY
];

// Unit number pattern: e.g. A-12-03, B-05-11, 3A-07-22
const UNIT_PATTERN = /\b([A-Z0-9]{1,3}-\d{2}-\d{2,3})\b/i;

// Amount patterns: RM xxx.xx, MYR xxx, RM1,234.56
const AMOUNT_PATTERNS = [
  /RM\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /MYR\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /\b([0-9]{1,3}(?:,\d{3})*(?:\.\d{2}))\b/,
];

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function normalizeDate(raw: string): string {
  // DD/MM/YYYY
  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (dmySlash) return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;

  // DD-MM-YYYY
  const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;

  // DD.MM.YYYY
  const dmyDot = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (dmyDot) return `${dmyDot[3]}-${dmyDot[2]}-${dmyDot[1]}`;

  // Already YYYY-MM-DD
  return raw;
}

/**
 * Extract date from a line of text.
 */
function extractDate(line: string): { value: string; confidence: number } {
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      return { value: normalizeDate(match[0]), confidence: 0.9 };
    }
  }
  return { value: new Date().toISOString().slice(0, 10), confidence: 0.1 };
}

/**
 * Extract project name from a line using known project list.
 */
function extractProject(line: string): { value: string; confidence: number } {
  const upper = line.toUpperCase();
  for (const proj of KNOWN_PROJECTS) {
    if (upper.includes(proj)) {
      return { value: proj, confidence: 0.95 };
    }
  }
  // Partial match: check if any word sequence matches
  for (const proj of KNOWN_PROJECTS) {
    const words = proj.split(' ');
    const firstWord = words[0];
    if (upper.includes(firstWord)) {
      return { value: proj, confidence: 0.5 };
    }
  }
  return { value: '', confidence: 0.0 };
}

/**
 * Extract unit number from a line.
 */
function extractUnitNo(line: string): { value: string; confidence: number } {
  const match = UNIT_PATTERN.exec(line);
  if (match) {
    return { value: match[1].toUpperCase(), confidence: 0.9 };
  }
  return { value: '', confidence: 0.0 };
}

/**
 * Extract monetary amount from a line.
 */
function extractAmount(line: string): { value: number | null; confidence: number } {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        return { value: num, confidence: 0.85 };
      }
    }
  }
  return { value: null, confidence: 0.0 };
}

/**
 * Extract description from a line (everything after known fields are removed).
 */
function extractDescription(line: string): string {
  let desc = line;

  // Remove date patterns
  for (const pattern of DATE_PATTERNS) {
    desc = desc.replace(pattern, '');
  }

  // Remove unit number
  desc = desc.replace(UNIT_PATTERN, '');

  // Remove amount patterns
  for (const pattern of AMOUNT_PATTERNS) {
    desc = desc.replace(pattern, '');
  }

  // Remove known project names
  for (const proj of KNOWN_PROJECTS) {
    desc = desc.replace(new RegExp(proj, 'gi'), '');
  }

  // Clean up remaining punctuation and whitespace
  return desc.replace(/[|,;:\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Compute overall confidence score for a parsed item.
 */
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

/**
 * Determine if a line is a meaningful data line (not header/blank/noise).
 */
function isDataLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5) return false;

  // Skip lines that are purely numeric (page numbers etc.)
  if (/^\d+$/.test(trimmed)) return false;

  // Must contain at least one alphanumeric char
  if (!/[a-zA-Z0-9]/.test(trimmed)) return false;

  return true;
}

/**
 * Parse raw OCR text into structured repair/invoice items.
 * Each non-empty line is treated as a potential record.
 * Lines containing unit numbers are prioritised as individual items.
 */
export function parseOcrText(rawText: string): ParseResult {
  const lines = rawText.split('\n');
  const items: ParsedItem[] = [];

  // Collect global date (first date found in document acts as fallback)
  let globalDate = new Date().toISOString().slice(0, 10);
  let globalProject = '';

  for (const line of lines) {
    if (!isDataLine(line)) continue;

    const dateResult = extractDate(line);
    if (dateResult.confidence > 0.5) {
      globalDate = dateResult.value;
    }

    const projectResult = extractProject(line);
    if (projectResult.confidence > 0.4 && !globalProject) {
      globalProject = projectResult.value;
    }
  }

  // Second pass: extract items per line
  for (const line of lines) {
    if (!isDataLine(line)) continue;

    const unitResult = extractUnitNo(line);

    // Only create a record if we found a unit number
    if (unitResult.confidence < 0.5) continue;

    const dateResult = extractDate(line);
    const projectResult = extractProject(line);
    const amountResult = extractAmount(line);
    const description = extractDescription(line);

    const date = dateResult.confidence > 0.5 ? dateResult.value : globalDate;
    const project = projectResult.confidence > 0.4 ? projectResult.value : globalProject;

    const confidence = computeConfidence(
      dateResult.confidence > 0.5 ? dateResult.confidence : 0.3,
      project ? (projectResult.confidence > 0.4 ? projectResult.confidence : 0.3) : 0.0,
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
      rawLine: line.trim(),
    });
  }

  return { items, rawText };
}
