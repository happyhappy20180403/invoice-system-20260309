import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ocrUploads } from '@/lib/db/schema';
import { parseOcrText, type ParsedItem } from '@/lib/ocr/parser';
import path from 'path';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Description post-processing (safety net for scan artifact corrections)
// ---------------------------------------------------------------------------

const DESCRIPTION_CORRECTIONS: Record<string, string> = {
  'BATROOM': 'BATHROOM',
  'BATHROM': 'BATHROOM',
  'TOILE ': 'TOILET ',
  'CEILNG': 'CEILING',
  'CEILLING': 'CEILING',
  'ATER HEATER': 'WATER HEATER',
  'ENRANCE': 'ENTRANCE',
  'ENTRACE': 'ENTRANCE',
  'WWINDOW': 'WINDOW',
  'WWATER': 'WATER',
  'VREMOTE': 'REMOTE',
  'KITHCEN': 'KITCHEN',
  'KTICHEN': 'KITCHEN',
  'DINNING': 'DINING',
};

function correctDescription(desc: string): string {
  let fixed = desc;
  for (const [wrong, right] of Object.entries(DESCRIPTION_CORRECTIONS)) {
    fixed = fixed.replace(new RegExp(wrong, 'gi'), right);
  }
  // Expand truncated words at end
  fixed = fixed.replace(/,\s*REP\s*$/i, ', REPAIR');
  fixed = fixed.replace(/\s+REP\s*$/i, ' REPAIR');
  fixed = fixed.replace(/,\s*REPL\s*$/i, ', REPLACE');
  // Remove trailing comma/period
  fixed = fixed.replace(/[,.\s]+$/, '');
  return fixed;
}

// Allowed MIME types and their extensions
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const isVercel = !!process.env.VERCEL;
const UPLOADS_DIR = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'data', 'uploads');

// ---------------------------------------------------------------------------
// Render PDF pages to PNG images via mupdf (shared utility)
// ---------------------------------------------------------------------------

async function renderPdfPages(buffer: Buffer): Promise<Buffer[]> {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  console.log(`[OCR] mupdf: ${pageCount} page(s)`);

  const pageImages: Buffer[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    // 2.0x scale + grayscale — optimal balance of quality and size
    const pixmap = page.toPixmap(
      [2.0, 0, 0, 2.0, 0, 0],
      mupdf.ColorSpace.DeviceGray,
      false,
      true,
    );
    const png = pixmap.asPNG();
    pageImages.push(Buffer.from(png));
    console.log(
      `[OCR] Page ${i + 1}: ${pixmap.getWidth()}x${pixmap.getHeight()} (${(png.length / 1024).toFixed(0)}KB)`,
    );
  }
  return pageImages;
}

// ---------------------------------------------------------------------------
// METHOD 1: Gemini Vision — structured JSON extraction (FREE, highest accuracy)
// ---------------------------------------------------------------------------

interface GeminiExtractedRow {
  date: string;
  project: string;
  unitNo: string;
  description: string;
  costAmount: number | null;
  finalPrice: number | null;
}

/** Extract the non-thinking text from Gemini response parts (handles 2.5 thinking mode) */
function extractGeminiText(
  data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> },
): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  // Find the last non-thinking part (Gemini 2.5 puts thinking first, response last)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i].thought && parts[i].text) {
      return parts[i].text!;
    }
  }
  // Fallback: return first part text
  return parts[0]?.text ?? '';
}

/** Parse JSON from Gemini text, stripping markdown fences */
function parseGeminiJson(text: string): GeminiExtractedRow[] {
  const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return JSON.parse(jsonStr);
}

const GEMINI_EXTRACTION_PROMPT = `You are a precise data extraction engine for property repair work orders. Read the scanned table carefully, character by character, and extract ALL line items.

TABLE COLUMNS (left to right):
1. Date (DD/MM/YYYY — this is MALAYSIAN format: DAY first, then MONTH)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, TROPEZ, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines in the table — merge into one)
5. Payment method (internet banking or petty cash)
6. Receipt No / Amount columns (printed numbers)
7. Tracking column
8. "Final Price (Claim to Customer) (RM)" — the RIGHTMOST column with HANDWRITTEN numbers

VALID REPAIR VOCABULARY (use these exact words when correcting descriptions):
BATHROOM, BEDROOM, KITCHEN, LIVING ROOM, DINING ROOM, ENTRANCE, TOILET, CEILING, WINDOW, DOOR,
WATER HEATER, COOKER HOOD, AIRCON, COMPRESSOR, WASHING MACHINE, CEILING FAN, SHOWER, BATHTUB,
PIPE, LEAKAGE, REPAIR, REPLACE, CHANGE, INSTALL, SWITCH, VALVE, PUMP, FLUSH, LOCK, REMOTE,
DIGITAL LOCK, WATERPROOFING, STICKER, CABINET, MATTRESS, LIGHTS, PLUG, RUBBER, COVER, GLASS,
FLOOR TRAP, SINK, CLOG, BLOCK, BURST, STAIN, TOUCH UP, ACCESS CARD, BEDSHEETS, STOPPER, TAP

SCAN ARTIFACT CORRECTIONS (always apply these):
- BATROOM / BATHROM → BATHROOM
- TOILE → TOILET
- CEILNG / CEILLING → CEILING
- ATER HEATER → WATER HEATER
- ENRANCE / ENTRACE → ENTRANCE
- WWINDOW → WINDOW
- WWATER → WATER
- VREMOTE → REMOTE
- KITHCEN / KTICHEN → KITCHEN
- DINNING → DINING
- Truncated "REP" at end of description → "REPAIR"
- Truncated "REPL" at end → "REPLACE"
- Remove stray punctuation at end (trailing commas, periods)

CRITICAL RULES:
- Extract ONLY the rows that actually exist in the table. Do NOT invent, duplicate, or hallucinate rows.
- If two rows look very similar but have different unit numbers or descriptions, they are separate rows.
- If a description spans two lines in the table, merge them into ONE row (not two).
- "costAmount" = the printed Internet Banking (RM) amount (Receipt Amount column)
- "finalPrice" = the HANDWRITTEN amount in the rightmost "Final Price (Claim to Customer)" column. Read handwriting carefully.
- If finalPrice is blank/unreadable, set it to null.
- Descriptions must use corrected vocabulary above. Fix ALL scan typos.
- Expand project abbreviations.

DATE FORMAT (VERY IMPORTANT):
- The table uses DD/MM/YYYY format (Malaysian standard).
- Output the date EXACTLY as it appears in the table: DD/MM/YYYY.
- Do NOT convert or reformat the date. Just copy it as-is.
- Example: if the table shows "04/03/2026", output "04/03/2026".

- Return ONLY valid JSON array. No markdown, no explanation.

Output format:
[{"date":"04/03/2026","project":"PONDEROSA","unitNo":"B-10-03","description":"COOKER HOOD REPAIR","costAmount":740,"finalPrice":1180},...]`;

/** Call Gemini API for a single page image with retry */
async function callGeminiPage(
  base64: string,
  apiKey: string,
  pageIdx: number,
  maxRetries = 1,
): Promise<GeminiExtractedRow[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * attempt; // 2s, 4s...
      console.log(`[OCR] Gemini retry ${attempt}/${maxRetries} for page ${pageIdx + 1} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: GEMINI_EXTRACTION_PROMPT },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        const status = response.status;
        // Retry on 429 (rate limit) or 5xx (server error)
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          lastError = new Error(`Gemini API ${status}: ${body.substring(0, 200)}`);
          console.warn(`[OCR] Gemini transient error ${status}, will retry...`);
          continue;
        }
        throw new Error(`Gemini API error ${status}: ${body.substring(0, 300)}`);
      }

      const data = await response.json();
      const text = extractGeminiText(data);
      console.log(`[OCR] Gemini page ${pageIdx + 1} response: ${text.length} chars, first 200: ${text.substring(0, 200)}`);

      return parseGeminiJson(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries && (String(err).includes('fetch') || String(err).includes('network'))) {
        console.warn(`[OCR] Gemini network error, will retry: ${String(err)}`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('Gemini: unknown error after retries');
}

// ---------------------------------------------------------------------------
// Post-processing: validate Gemini dates and deduplicate rows
// ---------------------------------------------------------------------------

/**
 * Validate DD/MM/YYYY format. If Gemini returned YYYY-MM-DD, convert to DD/MM/YYYY.
 */
function validateGeminiDate(dateStr: string): string {
  if (!dateStr) {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  }

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Gemini returned YYYY-MM-DD — convert to DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    console.log(`[OCR] Date convert: ${dateStr} → ${day}/${month}/${year}`);
    return `${day}/${month}/${year}`;
  }

  return dateStr;
}

/**
 * Remove duplicate rows from Gemini output.
 * Two rows are duplicates if they share the same project + unitNo + description.
 */
function deduplicateRows(rows: GeminiExtractedRow[]): GeminiExtractedRow[] {
  const seen = new Set<string>();
  const result: GeminiExtractedRow[] = [];
  for (const row of rows) {
    const key = `${row.project}|${row.unitNo}|${row.description}`.toUpperCase();
    if (seen.has(key)) {
      console.log(`[OCR] Removing duplicate row: ${key}`);
      continue;
    }
    seen.add(key);
    result.push(row);
  }
  if (result.length < rows.length) {
    console.log(`[OCR] Dedup: ${rows.length} → ${result.length} rows`);
  }
  return result;
}

async function extractWithGemini(pageImages: Buffer[]): Promise<ParsedItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const allItems: ParsedItem[] = [];

  for (let pageIdx = 0; pageIdx < pageImages.length; pageIdx++) {
    const base64 = pageImages[pageIdx].toString('base64');

    let rawRows: GeminiExtractedRow[];
    try {
      rawRows = await callGeminiPage(base64, apiKey, pageIdx);
    } catch (parseErr) {
      console.error(`[OCR] Gemini failed for page ${pageIdx + 1}:`, String(parseErr));
      throw parseErr; // Propagate so caller knows Gemini failed
    }

    // Post-process: deduplicate and validate dates
    const rows = deduplicateRows(rawRows);

    for (const row of rows) {
      const amount = typeof row.finalPrice === 'number' ? row.finalPrice
        : typeof row.costAmount === 'number' ? row.costAmount
        : null;
      const cost = typeof row.costAmount === 'number' ? row.costAmount : null;
      const desc = correctDescription(row.description || 'Repair/Maintenance');
      const validatedDate = validateGeminiDate(row.date);
      allItems.push({
        date: validatedDate || (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })(),
        project: row.project || '',
        unitNo: row.unitNo || '',
        description: desc,
        amount,
        confidence: row.finalPrice != null ? 0.95 : row.costAmount != null ? 0.8 : 0.5,
        rawLine: `[Gemini] ${validatedDate} ${row.project} ${row.unitNo} | cost:RM${cost ?? '?'} → claim:RM${amount ?? '?'}`,
      });
    }
  }

  console.log(`[OCR] Gemini extracted ${allItems.length} items total`);
  return allItems;
}

// ---------------------------------------------------------------------------
// METHOD 2: PDF text extraction via pdf-parse
// ---------------------------------------------------------------------------

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// ---------------------------------------------------------------------------
// METHOD 3: Scanned PDF OCR via mupdf + Tesseract.js
// ---------------------------------------------------------------------------

async function extractScannedPdfText(pageImages: Buffer[]): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const startTime = Date.now();

  const ocrPage = async (png: Buffer, pageIdx: number): Promise<string> => {
    const worker = await Tesseract.createWorker('eng');
    try {
      const { data } = await worker.recognize(png);
      console.log(`[OCR] Tesseract page ${pageIdx + 1}: ${data.text.length} chars`);
      return data.text;
    } finally {
      await worker.terminate();
    }
  };

  const pageTexts = await Promise.all(
    pageImages.map((png, i) => ocrPage(png, i)),
  );

  console.log(`[OCR] Tesseract done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
}

// ---------------------------------------------------------------------------
// METHOD 4: Tesseract.js for images (JPG/PNG)
// ---------------------------------------------------------------------------

async function extractImageText(buffer: Buffer): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// METHOD 5: Gemini Vision for single images (JPG/PNG)
// ---------------------------------------------------------------------------

async function extractImageWithGemini(buffer: Buffer, mimeType: string): Promise<ParsedItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const base64 = buffer.toString('base64');

  // Reuse the same retry-capable helper (treat image as "page 0")
  const rawRows = await callGeminiPage(base64, apiKey, 0);
  const rows = deduplicateRows(rawRows);

  return rows.map(row => {
    const amount = typeof row.finalPrice === 'number' ? row.finalPrice
      : typeof row.costAmount === 'number' ? row.costAmount
      : null;
    const cost = typeof row.costAmount === 'number' ? row.costAmount : null;
    const desc = correctDescription(row.description || 'Repair/Maintenance');
    const validatedDate = validateGeminiDate(row.date);
    return {
      date: validatedDate || (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })(),
      project: row.project || '',
      unitNo: row.unitNo || '',
      description: desc,
      amount,
      confidence: row.finalPrice != null ? 0.95 : row.costAmount != null ? 0.8 : 0.5,
      rawLine: `[Gemini] ${validatedDate} ${row.project} ${row.unitNo} | cost:RM${cost ?? '?'} → claim:RM${amount ?? '?'}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Google Cloud Vision (optional)
// ---------------------------------------------------------------------------

async function extractVisionText(buffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_KEY!;
  const base64 = buffer.toString('base64');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Vision API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  if (data.responses[0].error) {
    throw new Error(`Vision API: ${data.responses[0].error.message}`);
  }

  return data.responses[0].fullTextAnnotation?.text ?? '';
}

// ---------------------------------------------------------------------------
// Mock OCR (last resort fallback)
// ---------------------------------------------------------------------------

function generateMockItems(): ParsedItem[] {
  const today = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })();
  return [
    { date: today, project: 'MOLEK PINE', unitNo: 'A-12-03', description: 'Plumbing repair - leaking pipe', amount: 350, confidence: 0.5, rawLine: '[Mock]' },
    { date: today, project: 'MOLEK PINE', unitNo: 'B-05-11', description: 'Electrical fault - circuit breaker', amount: 580, confidence: 0.5, rawLine: '[Mock]' },
    { date: today, project: 'MOLEK PINE', unitNo: 'C-08-02', description: 'Painting - bedroom walls', amount: 1200, confidence: 0.5, rawLine: '[Mock]' },
  ];
}

// ---------------------------------------------------------------------------
// Main OCR dispatcher
// ---------------------------------------------------------------------------

/**
 * Run OCR and return structured items.
 *
 * Priority:
 *  1. Gemini Vision API (FREE, highest accuracy — structured JSON extraction)
 *  2. Google Cloud Vision → parseOcrText
 *  3. pdf-parse (text-layer PDFs) → parseOcrText
 *  4. mupdf + Tesseract.js (scanned PDFs) → parseOcrText
 *  5. Tesseract.js (images) → parseOcrText
 *  6. Mock fallback
 */
async function runOcr(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ items: ParsedItem[]; rawText: string; method: string; warnings: string[] }> {
  const isPdf = mimeType === 'application/pdf';
  const warnings: string[] = [];

  // Render PDF pages once (shared between Gemini and Tesseract paths)
  let pageImages: Buffer[] | null = null;
  if (isPdf) {
    try {
      pageImages = await renderPdfPages(buffer);
    } catch (err) {
      console.error(`[OCR] mupdf render failed:`, err);
    }
  }

  // Track whether Gemini was attempted and why it failed
  let geminiAttempted = false;
  let geminiFailReason = '';

  // 1. Gemini Vision — structured JSON extraction (best accuracy)
  if (process.env.GEMINI_API_KEY) {
    geminiAttempted = true;
    console.log(`[OCR] Using Gemini Vision for "${filename}"`);
    try {
      let items: ParsedItem[];
      if (isPdf && pageImages) {
        items = await extractWithGemini(pageImages);
      } else {
        items = await extractImageWithGemini(buffer, mimeType);
      }
      if (items.length > 0) {
        const rawText = items.map(i =>
          `${i.date} | ${i.project} | ${i.unitNo} | ${i.description} | RM ${i.amount ?? '?'}`
        ).join('\n');
        return { items, rawText, method: 'gemini-vision', warnings };
      }
      geminiFailReason = `Gemini returned 0 items — the image may not contain a recognizable table`;
      console.warn(`[OCR] ${geminiFailReason}`);
      warnings.push(geminiFailReason);
    } catch (err) {
      geminiFailReason = String(err).replace(/key=AI[^\s&"']*/gi, 'key=***');
      const msg = `Gemini Vision failed (with retry): ${geminiFailReason}`;
      console.error(`[OCR] ${msg}`);
      warnings.push(msg);
    }
  } else {
    geminiFailReason = 'GEMINI_API_KEY is not set';
    warnings.push('GEMINI_API_KEY is not set. Using low-accuracy local OCR.');
  }

  // 2. Google Cloud Vision → text → parse
  if (process.env.GOOGLE_CLOUD_VISION_KEY) {
    console.log(`[OCR] Using Google Cloud Vision for "${filename}"`);
    try {
      const text = await extractVisionText(buffer);
      if (text.trim().length > 50) {
        return { items: parseOcrText(text).items, rawText: text, method: 'google-vision', warnings };
      }
    } catch (err) {
      console.warn(`[OCR] Cloud Vision failed:`, err);
    }
  }

  // 3. pdf-parse — text-layer PDFs only
  if (isPdf) {
    console.log(`[OCR] Trying pdf-parse for "${filename}"`);
    try {
      const text = await extractPdfText(buffer);
      const meaningful = text.replace(/[\s\r\n\t\f\v\x00-\x1f]+/g, '');
      console.log(`[OCR] pdf-parse: meaningful=${meaningful.length} chars`);
      if (meaningful.length > 50) {
        return { items: parseOcrText(text).items, rawText: text, method: 'pdf-parse', warnings };
      }
    } catch (err) {
      console.warn(`[OCR] pdf-parse failed:`, err);
    }
  }

  // 4. mupdf + Tesseract.js — scanned PDFs
  if (isPdf && pageImages) {
    console.log(`[OCR] Using Tesseract.js for scanned PDF "${filename}"`);
    try {
      const text = await extractScannedPdfText(pageImages);
      const meaningful = text.replace(/[\s\r\n\t\f\v]+/g, '');
      console.log(`[OCR] Tesseract: meaningful=${meaningful.length} chars`);
      if (meaningful.length > 20) {
        const parsedItems = parseOcrText(text).items;
        const { avgConfidence, qualityOk } = assessQuality(parsedItems);

        if (geminiAttempted) {
          warnings.push(`Gemini Vision failed: ${geminiFailReason}. Fell back to local Tesseract OCR.`);
        }
        warnings.push(`Local OCR (Tesseract) accuracy is limited. Average confidence: ${Math.round(avgConfidence * 100)}%.`);
        if (!qualityOk) {
          warnings.push('LOW QUALITY WARNING: Results are likely inaccurate. Please verify every field carefully or re-upload after checking your GEMINI_API_KEY.');
        }
        return { items: parsedItems, rawText: text, method: 'mupdf+tesseract', warnings };
      }
    } catch (err) {
      console.error(`[OCR] Tesseract failed:`, err);
    }
  }

  // 5. Tesseract.js — image files
  if (!isPdf) {
    console.log(`[OCR] Using Tesseract.js for image "${filename}"`);
    try {
      const text = await extractImageText(buffer);
      const parsedItems = parseOcrText(text).items;
      const { avgConfidence, qualityOk } = assessQuality(parsedItems);

      if (geminiAttempted) {
        warnings.push(`Gemini Vision failed: ${geminiFailReason}. Fell back to local Tesseract OCR.`);
      }
      warnings.push(`Local OCR (Tesseract) accuracy is limited. Average confidence: ${Math.round(avgConfidence * 100)}%.`);
      if (!qualityOk) {
        warnings.push('LOW QUALITY WARNING: Results are likely inaccurate. Please verify every field carefully or re-upload after checking your GEMINI_API_KEY.');
      }
      return { items: parsedItems, rawText: text, method: 'tesseract', warnings };
    } catch (err) {
      console.warn(`[OCR] Tesseract failed:`, err);
    }
  }

  // 6. Mock fallback
  console.warn(`[OCR] All methods failed — using mock data`);
  return { items: generateMockItems(), rawText: '[Mock OCR data]', method: 'mock', warnings };
}

// ---------------------------------------------------------------------------
// Quality gate: assess Tesseract output quality
// ---------------------------------------------------------------------------

function assessQuality(items: ParsedItem[]): { avgConfidence: number; qualityOk: boolean } {
  if (items.length === 0) return { avgConfidence: 0, qualityOk: false };
  const avgConfidence = items.reduce((sum, i) => sum + i.confidence, 0) / items.length;
  // Quality is OK only if average confidence >= 0.5 (50%)
  return { avgConfidence, qualityOk: avgConfidence >= 0.5 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureUploadsDir(): Promise<void> {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const uploadedFile = file as File;
  const mimeType = uploadedFile.type;

  if (!ALLOWED_TYPES[mimeType]) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}` },
      { status: 415 },
    );
  }

  if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum 10 MB' },
      { status: 413 },
    );
  }

  const ext = ALLOWED_TYPES[mimeType];
  const fileType = ext === 'pdf' ? 'pdf' : 'image';
  const safeFilename = `${Date.now()}-${uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const arrayBuffer = await uploadedFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  await fs.writeFile(filePath, buffer);

  let result: { items: ParsedItem[]; rawText: string; method: string; warnings: string[] };
  try {
    result = await runOcr(buffer, mimeType, uploadedFile.name);
  } catch (ocrError) {
    await fs.unlink(filePath).catch(() => null);
    return NextResponse.json(
      { error: `OCR failed: ${String(ocrError)}` },
      { status: 500 },
    );
  }

  const { items, rawText, method: ocrMethod, warnings } = result;
  console.log(`[OCR] "${ocrMethod}" → ${items.length} items from "${uploadedFile.name}"${warnings.length > 0 ? ` (warnings: ${warnings.join('; ')})` : ''}`);

  const userId = session.user?.email ?? 'unknown';
  const insertResult = await db
    .insert(ocrUploads)
    .values({
      filename: safeFilename,
      fileType,
      rawText,
      parsedData: JSON.stringify(items),
      status: 'parsed',
      createdBy: userId,
    })
    .returning({ id: ocrUploads.id })
    .get();

  return NextResponse.json({
    uploadId: insertResult.id,
    filename: safeFilename,
    rawText,
    items,
    isMock: ocrMethod === 'mock',
    ocrMethod,
    warnings,
  });
}
