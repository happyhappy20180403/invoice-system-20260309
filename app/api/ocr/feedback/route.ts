import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveFeedback } from '@/lib/ocr/feedback';
import type { FeedbackPayload } from '@/lib/ocr/feedback';

/**
 * POST /api/ocr/feedback
 * Saves user corrections for an OCR upload.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: FeedbackPayload;
  try {
    body = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.uploadId || typeof body.uploadId !== 'number') {
    return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 });
  }

  try {
    await saveFeedback(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save feedback: ${String(err)}` },
      { status: 500 },
    );
  }
}
