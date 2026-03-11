import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ocrUploads } from '@/lib/db/schema';
import { parseOcrText, type ParsedItem } from '@/lib/ocr/parser';
import path from 'path';
import fs from 'fs/promises';

// Allowed MIME types and their extensions
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

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

const GEMINI_EXTRACTION_PROMPT = `You are a precise data extraction engine. Extract ALL repair/maintenance line items from this scanned repair work order table.

The table has these columns (left to right):
1. Date (DD/MM/YYYY)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines)
5. Payment method (internet banking or petty cash)
6. Receipt No / Amount columns (printed numbers)
7. Tracking column
8. **"Final Price (Claim to Customer) (RM)"** — the RIGHTMOST column. These are often HANDWRITTEN numbers. This is the most important amount.

CRITICAL RULES:
- Extract EVERY row. Do not skip any.
- "costAmount" = the printed Internet Banking (RM) amount (column 6)
- "finalPrice" = the HANDWRITTEN amount in the rightmost "Final Price (Claim to Customer)" column. READ THE HANDWRITING CAREFULLY.
- If finalPrice is blank/unreadable for a row, set it to null.
- Some descriptions span 2 lines — merge them into one description.
- Expand project abbreviations.
- Date format: YYYY-MM-DD
- Return ONLY valid JSON array. No markdown, no explanation.

Output format:
[{"date":"2026-02-03","project":"PONDEROSA","unitNo":"B-10-03","description":"Cooker hood repair","costAmount":740,"finalPrice":1180},...]`;

async function extractWithGemini(pageImages: Buffer[]): Promise<ParsedItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const allItems: ParsedItem[] = [];

  for (let pageIdx = 0; pageIdx < pageImages.length; pageIdx++) {
    const base64 = pageImages[pageIdx].toString('base64');

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
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log(`[OCR] Gemini page ${pageIdx + 1} response: ${text.length} chars`);

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    let rows: GeminiExtractedRow[];
    try {
      rows = JSON.parse(jsonStr);
    } catch {
      console.error(`[OCR] Gemini returned non-JSON for page ${pageIdx + 1}:`, text.substring(0, 200));
      continue;
    }

    for (const row of rows) {
      // Use finalPrice (claim to customer) if available, otherwise fall back to costAmount
      const amount = typeof row.finalPrice === 'number' ? row.finalPrice
        : typeof row.costAmount === 'number' ? row.costAmount
        : null;
      const cost = typeof row.costAmount === 'number' ? row.costAmount : null;
      allItems.push({
        date: row.date || new Date().toISOString().slice(0, 10),
        project: row.project || '',
        unitNo: row.unitNo || '',
        description: row.description || 'Repair/Maintenance',
        amount,
        confidence: row.finalPrice != null ? 0.95 : row.costAmount != null ? 0.8 : 0.5,
        rawLine: `[Gemini] ${row.date} ${row.project} ${row.unitNo} | cost:RM${cost ?? '?'} → claim:RM${amount ?? '?'}`,
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
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const rows: GeminiExtractedRow[] = JSON.parse(jsonStr);

  return rows.map(row => {
    const amount = typeof row.finalPrice === 'number' ? row.finalPrice
      : typeof row.costAmount === 'number' ? row.costAmount
      : null;
    const cost = typeof row.costAmount === 'number' ? row.costAmount : null;
    return {
      date: row.date || new Date().toISOString().slice(0, 10),
      project: row.project || '',
      unitNo: row.unitNo || '',
      description: row.description || 'Repair/Maintenance',
      amount,
      confidence: row.finalPrice != null ? 0.95 : row.costAmount != null ? 0.8 : 0.5,
      rawLine: `[Gemini] ${row.date} ${row.project} ${row.unitNo} | cost:RM${cost ?? '?'} → claim:RM${amount ?? '?'}`,
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
  const today = new Date().toISOString().slice(0, 10);
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
): Promise<{ items: ParsedItem[]; rawText: string; method: string }> {
  const isPdf = mimeType === 'application/pdf';

  // Render PDF pages once (shared between Gemini and Tesseract paths)
  let pageImages: Buffer[] | null = null;
  if (isPdf) {
    try {
      pageImages = await renderPdfPages(buffer);
    } catch (err) {
      console.error(`[OCR] mupdf render failed:`, err);
    }
  }

  // 1. Gemini Vision — structured JSON extraction (best accuracy)
  if (process.env.GEMINI_API_KEY) {
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
        return { items, rawText, method: 'gemini-vision' };
      }
      console.warn(`[OCR] Gemini returned 0 items for "${filename}"`);
    } catch (err) {
      console.error(`[OCR] Gemini failed for "${filename}":`, err);
    }
  }

  // 2. Google Cloud Vision → text → parse
  if (process.env.GOOGLE_CLOUD_VISION_KEY) {
    console.log(`[OCR] Using Google Cloud Vision for "${filename}"`);
    try {
      const text = await extractVisionText(buffer);
      if (text.trim().length > 50) {
        return { items: parseOcrText(text).items, rawText: text, method: 'google-vision' };
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
        return { items: parseOcrText(text).items, rawText: text, method: 'pdf-parse' };
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
        return { items: parseOcrText(text).items, rawText: text, method: 'mupdf+tesseract' };
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
      return { items: parseOcrText(text).items, rawText: text, method: 'tesseract' };
    } catch (err) {
      console.warn(`[OCR] Tesseract failed:`, err);
    }
  }

  // 6. Mock fallback
  console.warn(`[OCR] All methods failed — using mock data`);
  return { items: generateMockItems(), rawText: '[Mock OCR data]', method: 'mock' };
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

  let result: { items: ParsedItem[]; rawText: string; method: string };
  try {
    result = await runOcr(buffer, mimeType, uploadedFile.name);
  } catch (ocrError) {
    await fs.unlink(filePath).catch(() => null);
    return NextResponse.json(
      { error: `OCR failed: ${String(ocrError)}` },
      { status: 500 },
    );
  }

  const { items, rawText, method: ocrMethod } = result;
  console.log(`[OCR] "${ocrMethod}" → ${items.length} items from "${uploadedFile.name}"`);

  const userId = session.user?.email ?? 'unknown';
  const insertResult = db
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
  });
}
