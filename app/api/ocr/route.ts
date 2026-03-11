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

/**
 * Call Google Cloud Vision API to extract text from a file buffer.
 * Falls back to mock OCR when GOOGLE_CLOUD_VISION_KEY is not set.
 */
async function runOcr(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_KEY;

  if (!apiKey) {
    // Mock OCR for development / testing
    return generateMockOcrText(filename);
  }

  // Real Google Cloud Vision API call
  // Vision API accepts base64-encoded content
  const base64 = buffer.toString('base64');

  const requestBody = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vision API error ${response.status}: ${errorBody}`);
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

/**
 * Generate realistic mock OCR text for development use.
 */
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
Note: Set GOOGLE_CLOUD_VISION_KEY in .env to use real OCR`;
}

/**
 * Ensure the uploads directory exists.
 */
async function ensureUploadsDir(): Promise<void> {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

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

  // Type guard: file is a Blob/File at this point
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
  let rawText: string;
  try {
    rawText = await runOcr(buffer, mimeType, uploadedFile.name);
  } catch (ocrError) {
    // Clean up uploaded file on OCR failure
    await fs.unlink(filePath).catch(() => null);
    return NextResponse.json(
      { error: `OCR processing failed: ${String(ocrError)}` },
      { status: 500 },
    );
  }

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
    isMock: !process.env.GOOGLE_CLOUD_VISION_KEY,
  });
}
