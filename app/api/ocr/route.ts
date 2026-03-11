import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ocrUploads } from '@/lib/db/schema';
import { parseOcrText } from '@/lib/ocr/parser';
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
// PDF text extraction via pdf-parse
// ---------------------------------------------------------------------------

/**
 * Extract text from a PDF buffer using pdf-parse (class-based API v2+).
 * PDFParse.load() parses the document, getText() returns the full text.
 */
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
// Image OCR via Tesseract.js
// ---------------------------------------------------------------------------

/**
 * OCR an image buffer with Tesseract.js.
 */
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
// Scanned PDF OCR via mupdf (WASM) + Tesseract.js
// ---------------------------------------------------------------------------

/**
 * Convert each PDF page to a PNG image using mupdf (WASM), then OCR with
 * Tesseract.js. Works for scanned/image-only PDFs without native dependencies.
 */
async function extractScannedPdfText(buffer: Buffer): Promise<string> {
  const mupdf = await import('mupdf');
  const Tesseract = await import('tesseract.js');

  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  const pageCount = doc.countPages();
  console.log(`[OCR] mupdf: ${pageCount} page(s) to process`);

  const worker = await Tesseract.createWorker('eng');

  try {
    const pageTexts: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      // Scale 2x for better OCR accuracy
      const pixmap = page.toPixmap(
        [2, 0, 0, 2, 0, 0],
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
      const png = pixmap.asPNG();
      console.log(
        `[OCR] Page ${i + 1}/${pageCount}: ${pixmap.getWidth()}x${pixmap.getHeight()}`,
      );

      const { data } = await worker.recognize(Buffer.from(png));
      pageTexts.push(data.text);
    }

    return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Google Cloud Vision (optional, if API key is present)
// ---------------------------------------------------------------------------

/**
 * Extract text via Google Cloud Vision TEXT_DETECTION.
 */
async function extractVisionText(buffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_KEY!;
  const base64 = buffer.toString('base64');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vision API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const result = data.responses[0];
  if (result.error) {
    throw new Error(`Vision API returned error: ${result.error.message}`);
  }

  return result.fullTextAnnotation?.text ?? '';
}

// ---------------------------------------------------------------------------
// Mock OCR (last resort fallback)
// ---------------------------------------------------------------------------

function generateMockOcrText(filename: string): string {
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return `REPAIR WORK ORDER
Date: ${dateStr}
Project: MOLEK PINE

Unit: A-12-03  Description: Plumbing repair - leaking pipe under sink  RM 350.00
Unit: B-05-11  Description: Electrical fault - replace circuit breaker  RM 580.00
Unit: C-08-02  Description: Painting - bedroom walls repaint  RM 1,200.00
Unit: A-07-15  Description: Air conditioning service and gas refill  RM 420.00
Unit: D-03-09  Description: Door lock replacement  RM 180.00

Total: RM 2,730.00

[MOCK OCR - file: ${filename}]
Note: Set GOOGLE_CLOUD_VISION_KEY in .env to use Google Cloud Vision`;
}

// ---------------------------------------------------------------------------
// Main OCR dispatcher
// ---------------------------------------------------------------------------

/**
 * Run OCR on the supplied buffer using the best available method:
 *
 * Priority order:
 *  1. Google Cloud Vision (if GOOGLE_CLOUD_VISION_KEY is set)
 *  2. pdf-parse for PDFs  (extracts embedded text layer — no AI needed)
 *  3. Tesseract.js for images (local neural-net OCR — no API key needed)
 *  4. Mock text (development fallback of last resort)
 */
async function runOcr(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ text: string; method: string }> {
  const isPdf = mimeType === 'application/pdf';

  // 1. Google Cloud Vision (optional premium path)
  if (process.env.GOOGLE_CLOUD_VISION_KEY) {
    console.log(`[OCR] Using Google Cloud Vision for "${filename}"`);
    const text = await extractVisionText(buffer);
    return { text, method: 'google-vision' };
  }

  // 2. pdf-parse — fast, no AI, works on PDFs with a text layer
  if (isPdf) {
    console.log(`[OCR] Using pdf-parse for "${filename}"`);
    try {
      const text = await extractPdfText(buffer);
      if (text.trim().length > 20) {
        // Meaningful text was found in the PDF
        return { text, method: 'pdf-parse' };
      }
      console.log(
        `[OCR] pdf-parse returned little/no text for "${filename}" — falling back to Tesseract`,
      );
    } catch (err) {
      console.warn(`[OCR] pdf-parse failed for "${filename}":`, err);
    }
  }

  // 3. Scanned PDF → mupdf renders pages to images → Tesseract OCR
  if (isPdf) {
    console.log(`[OCR] Using mupdf + Tesseract.js for scanned PDF "${filename}"`);
    try {
      const text = await extractScannedPdfText(buffer);
      if (text.trim().length > 20) {
        return { text, method: 'mupdf+tesseract' };
      }
    } catch (err) {
      console.warn(`[OCR] mupdf+Tesseract failed for "${filename}":`, err);
    }
  }

  // 4. Tesseract.js — for image files (JPG/PNG)
  if (!isPdf) {
    console.log(`[OCR] Using Tesseract.js for "${filename}"`);
    try {
      const text = await extractImageText(buffer);
      return { text, method: 'tesseract' };
    } catch (err) {
      console.warn(`[OCR] Tesseract.js failed for "${filename}":`, err);
    }
  }

  // 5. Mock fallback
  console.warn(
    `[OCR] All methods failed or unavailable for "${filename}" — using mock data`,
  );
  return { text: generateMockOcrText(filename), method: 'mock' };
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

/**
 * POST /api/ocr
 * Accepts multipart/form-data with a 'file' field.
 * Returns extracted text and parsed items.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid multipart/form-data request' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const uploadedFile = file as File;

  // Validate MIME type
  const mimeType = uploadedFile.type;
  if (!ALLOWED_TYPES[mimeType]) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${mimeType}. Allowed: PDF, JPEG, PNG`,
      },
      { status: 415 },
    );
  }

  // Validate file size
  if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB' },
      { status: 413 },
    );
  }

  const ext = ALLOWED_TYPES[mimeType];
  const fileType = ext === 'pdf' ? 'pdf' : 'image';
  const safeFilename = `${Date.now()}-${uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Read file into buffer
  const arrayBuffer = await uploadedFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save file to disk
  await ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  await fs.writeFile(filePath, buffer);

  // Run OCR
  let ocrResult: { text: string; method: string };
  try {
    ocrResult = await runOcr(buffer, mimeType, uploadedFile.name);
  } catch (ocrError) {
    await fs.unlink(filePath).catch(() => null);
    return NextResponse.json(
      { error: `OCR processing failed: ${String(ocrError)}` },
      { status: 500 },
    );
  }

  const { text: rawText, method: ocrMethod } = ocrResult;
  console.log(
    `[OCR] Method="${ocrMethod}" extracted ${rawText.length} chars from "${uploadedFile.name}"`,
  );

  // Parse OCR text into structured data
  const parseResult = parseOcrText(rawText);

  // Persist to DB
  const userId = session.user?.email ?? 'unknown';
  const insertResult = db
    .insert(ocrUploads)
    .values({
      filename: safeFilename,
      fileType,
      rawText,
      parsedData: JSON.stringify(parseResult.items),
      status: 'parsed',
      createdBy: userId,
    })
    .returning({ id: ocrUploads.id })
    .get();

  return NextResponse.json({
    uploadId: insertResult.id,
    filename: safeFilename,
    rawText,
    items: parseResult.items,
    isMock: ocrMethod === 'mock',
    ocrMethod,
  });
}
