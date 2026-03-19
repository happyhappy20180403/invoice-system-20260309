/**
 * OCR Feedback Learning Module
 * Collects user correction patterns to improve future OCR parsing accuracy.
 */

import { db } from '@/lib/db';
import { ocrUploads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface CorrectionEntry {
  field: 'date' | 'project' | 'unitNo' | 'description' | 'amount';
  original: string;
  corrected: string;
  rawLine: string;
  uploadId: number;
}

export interface FeedbackPayload {
  uploadId: number;
  corrections: CorrectionEntry[];
  confirmedItems: Array<{
    date: string;
    project: string;
    unitNo: string;
    description: string;
    amount: number | null;
  }>;
}

/**
 * Save user correction feedback for an OCR upload.
 * The corrections are merged into the upload's parsedData as a 'feedback' key.
 * This data can later be analysed to improve the parser patterns.
 */
export async function saveFeedback(payload: FeedbackPayload): Promise<void> {
  const { uploadId, corrections, confirmedItems } = payload;

  // Fetch existing record
  const existing = await db
    .select()
    .from(ocrUploads)
    .where(eq(ocrUploads.id, uploadId))
    .get();

  if (!existing) return;

  const existingParsed = existing.parsedData
    ? JSON.parse(existing.parsedData)
    : {};

  const updatedParsed = {
    ...existingParsed,
    feedback: {
      corrections,
      confirmedItems,
      recordedAt: Date.now(),
    },
  };

  await db.update(ocrUploads)
    .set({
      parsedData: JSON.stringify(updatedParsed),
      status: 'confirmed',
    })
    .where(eq(ocrUploads.id, uploadId))
    .run();
}

/**
 * Mark an OCR upload as errored with a reason.
 */
export async function markUploadError(
  uploadId: number,
  reason: string,
): Promise<void> {
  await db.update(ocrUploads)
    .set({ status: 'error', parsedData: JSON.stringify({ error: reason }) })
    .where(eq(ocrUploads.id, uploadId))
    .run();
}

/**
 * Retrieve aggregated correction patterns for analysis.
 * Returns a frequency map: { field -> { original -> corrected -> count } }
 */
export async function getCorrectionPatterns(): Promise<Record<
  string,
  Record<string, Record<string, number>>
>> {
  const uploads = await db
    .select({ parsedData: ocrUploads.parsedData })
    .from(ocrUploads)
    .all();

  const patterns: Record<string, Record<string, Record<string, number>>> = {};

  for (const upload of uploads) {
    if (!upload.parsedData) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(upload.parsedData);
    } catch {
      continue;
    }

    const feedback = parsed.feedback;
    if (!feedback?.corrections) continue;

    for (const correction of feedback.corrections as CorrectionEntry[]) {
      const { field, original, corrected } = correction;
      if (!patterns[field]) patterns[field] = {};
      if (!patterns[field][original]) patterns[field][original] = {};
      patterns[field][original][corrected] =
        (patterns[field][original][corrected] ?? 0) + 1;
    }
  }

  return patterns;
}
