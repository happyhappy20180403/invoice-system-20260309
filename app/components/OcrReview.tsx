'use client';

import { useState, useCallback } from 'react';
import type { ParsedItem } from '@/lib/ocr/parser';
import type { PreviewData } from './InvoiceDashboard';
import { fuzzyMatchAction } from '@/app/actions/match';

interface OcrReviewItem extends ParsedItem {
  editDate: string;
  editProject: string;
  editUnitNo: string;
  editDescription: string;
  editAmount: string;
  selected: boolean;
}

interface Props {
  uploadId: number;
  rawText: string;
  items: ParsedItem[];
  isMock: boolean;
  ocrMethod?: string;
  warnings?: string[];
  onConfirm: (items: PreviewData[]) => void;
  onBack: () => void;
}

function toEditable(item: ParsedItem): OcrReviewItem {
  return {
    ...item,
    editDate: item.date,
    editProject: item.project,
    editUnitNo: item.unitNo,
    editDescription: item.description,
    editAmount: item.amount !== null ? String(item.amount) : '',
    selected: item.confidence >= 0.4,
  };
}

function confidenceColor(conf: number): string {
  if (conf >= 0.75) return 'bg-green-100 text-green-700';
  if (conf >= 0.45) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function OcrReview({
  uploadId,
  rawText,
  items,
  isMock,
  ocrMethod,
  warnings,
  onConfirm,
  onBack,
}: Props) {
  const [editableItems, setEditableItems] = useState<OcrReviewItem[]>(
    items.map(toEditable),
  );
  const [showRaw, setShowRaw] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const updateField = useCallback(
    (index: number, field: keyof OcrReviewItem, value: string | boolean) => {
      setEditableItems(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const toggleAll = (checked: boolean) => {
    setEditableItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const selectedItems = editableItems.filter(item => item.selected);
  const highConfCount = editableItems.filter(i => i.confidence >= 0.75).length;
  const lowConfCount = editableItems.filter(i => i.confidence < 0.45).length;

  // Detect low quality: Gemini failed and fell back to Tesseract with poor results
  const avgConfidence = editableItems.length > 0
    ? editableItems.reduce((sum, i) => sum + i.confidence, 0) / editableItems.length
    : 0;
  const hasLowQuality = ocrMethod !== 'gemini-vision' && ocrMethod !== 'mock' && (
    avgConfidence < 0.6 || warnings?.some(w => w.includes('LOW QUALITY')) || false
  );

  const handleConfirm = useCallback(async () => {
    if (selectedItems.length === 0) {
      setConfirmError('Please select at least one item to confirm.');
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      const previews: PreviewData[] = [];

      for (const item of selectedItems) {
        const amount = parseFloat(item.editAmount);
        if (isNaN(amount) || amount <= 0) continue;

        const suggestions = await fuzzyMatchAction(
          item.editProject,
          item.editUnitNo,
          item.editDescription,
        );
        const best = suggestions[0];

        // Parse date safely without timezone shift
        const [year, month] = item.editDate.split('-').map(Number);
        const dueDate = new Date(year, month, 0); // last day of same month

        previews.push({
          date: item.editDate,
          dueDate: dueDate.toISOString().slice(0, 10),
          project: item.editProject,
          unitNo: item.editUnitNo,
          description: item.editDescription,
          finalPrice: amount,
          contactName: best?.contactName ?? '',
          accountCode: best?.accountCode ?? '',
          taxType: best?.taxType ?? 'NONE',
          invoiceType: best?.invoiceType ?? 'ACCREC',
          trackingOption1: best?.trackingOption1 ?? '',
          trackingOption2: best?.trackingOption2 ?? '',
          reference: best?.reference ?? '',
          quantity: best?.quantity ?? 1,
          unitAmount: best?.unitAmount,
          suggestions,
        });
      }

      fetch('/api/ocr/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          confirmedItems: selectedItems.map(item => ({
            date: item.editDate,
            project: item.editProject,
            unitNo: item.editUnitNo,
            description: item.editDescription,
            amount: parseFloat(item.editAmount) || null,
          })),
          corrections: [],
        }),
      }).catch(() => null);

      onConfirm(previews);
    } catch (err) {
      setConfirmError(String(err));
    } finally {
      setIsConfirming(false);
    }
  }, [selectedItems, uploadId, onConfirm]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">OCR Review</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>{items.length} items detected</span>
            {ocrMethod && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                ocrMethod === 'gemini-vision'
                  ? 'bg-green-100 text-green-700'
                  : ocrMethod === 'mock'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {ocrMethod}
              </span>
            )}
            {isMock && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                Mock data
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">
              {highConfCount} high
            </span>
            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-700">
              {items.length - highConfCount - lowConfCount} mid
            </span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
              {lowConfCount} low
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Upload
          </button>
        </div>
      </div>

      {/* CRITICAL: Low quality / Gemini failure warning */}
      {hasLowQuality && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-center gap-2 font-bold">
            <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            LOW ACCURACY - Data may be incorrect
          </div>
          <p className="mt-1.5">
            Gemini Vision API failed and the system fell back to local Tesseract OCR, which cannot accurately read this document.
            <strong> Please verify every field carefully before confirming.</strong>
          </p>
          <p className="mt-1 text-xs text-red-700">
            To fix: check your <code className="rounded bg-red-100 px-1">GEMINI_API_KEY</code> in .env.local, then re-upload the file.
          </p>
        </div>
      )}

      {/* Warnings from OCR pipeline (non-critical) */}
      {warnings && warnings.length > 0 && !hasLowQuality && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>OCR Notice:</strong>
          <ul className="mt-1 list-inside list-disc">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Tesseract accuracy warning (when no critical warnings) */}
      {ocrMethod && ocrMethod !== 'gemini-vision' && ocrMethod !== 'mock' && !hasLowQuality && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>Accuracy notice:</strong> Using local OCR ({ocrMethod}). For higher accuracy,
          add <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code> to .env.local
          (free at <span className="underline">aistudio.google.com/apikey</span>).
        </div>
      )}

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        <span>
          <strong>Selected:</strong> {selectedItems.length} / {editableItems.length}
        </span>
        <span className="text-blue-300">|</span>
        <span>All fields are editable. Fix OCR errors before confirming.</span>
        <span className="text-blue-300">|</span>
        <span>Confirm will match against past invoices for auto-fill.</span>
      </div>

      {/* Raw text toggle */}
      <div className="rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setShowRaw(v => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <span>Raw OCR Text</span>
          <svg
            className={`h-4 w-4 transition-transform ${showRaw ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showRaw && (
          <div className="border-t border-gray-200 px-4 py-3">
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-gray-600">
              {rawText}
            </pre>
          </div>
        )}
      </div>

      {/* Items table — full width */}
      {editableItems.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          No items could be extracted. Check the raw text above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="w-10 px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={editableItems.every(i => i.selected)}
                    onChange={e => toggleAll(e.target.checked)}
                    className="rounded"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-2.5 text-center text-xs font-medium text-gray-500">#</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Project</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Unit No</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500">Amount (RM)</th>
                <th className="px-2 py-2.5 text-center text-xs font-medium text-gray-500">Conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editableItems.map((item, idx) => (
                <tr
                  key={idx}
                  className={[
                    'transition-colors',
                    item.selected ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-50',
                  ].join(' ')}
                >
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={e => updateField(idx, 'selected', e.target.checked)}
                      className="rounded"
                      aria-label={`Select item ${idx + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-gray-400">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={item.editDate}
                      onChange={e => updateField(idx, 'editDate', e.target.value)}
                      disabled={!item.selected}
                      className="w-[130px] rounded border border-gray-200 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.editProject}
                      onChange={e => updateField(idx, 'editProject', e.target.value)}
                      disabled={!item.selected}
                      placeholder="Project"
                      className="w-[140px] rounded border border-gray-200 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.editUnitNo}
                      onChange={e => updateField(idx, 'editUnitNo', e.target.value)}
                      disabled={!item.selected}
                      placeholder="A-00-00"
                      className="w-[90px] rounded border border-gray-200 px-1.5 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={item.editDescription}
                      onChange={e => updateField(idx, 'editDescription', e.target.value)}
                      disabled={!item.selected}
                      placeholder="Description"
                      className="w-full min-w-[250px] rounded border border-gray-200 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={item.editAmount}
                      onChange={e => updateField(idx, 'editAmount', e.target.value)}
                      disabled={!item.selected}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-[100px] rounded border border-gray-200 px-1.5 py-1 text-right text-xs font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor(item.confidence)}`}
                    >
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Source lines */}
      {editableItems.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600">
            Show source lines ({editableItems.length})
          </summary>
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-3">
            {editableItems.map((item, idx) => (
              <div key={idx} className="font-mono">
                <span className="mr-2 text-gray-300">#{idx + 1}</span>
                {item.rawLine}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Error */}
      {confirmError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {confirmError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming || selectedItems.length === 0}
          className={[
            'flex-1 rounded-lg px-6 py-3 font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-gray-300',
            hasLowQuality
              ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-200'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200',
          ].join(' ')}
        >
          {isConfirming
            ? 'Matching with past invoices...'
            : hasLowQuality
              ? `Confirm ${selectedItems.length} Item${selectedItems.length !== 1 ? 's' : ''} (Low Accuracy - Verify First!)`
              : `Confirm ${selectedItems.length} Item${selectedItems.length !== 1 ? 's' : ''} & Match`}
        </button>
        <p className="text-xs text-gray-400 max-w-xs">
          {hasLowQuality
            ? 'Low accuracy mode. Please verify all fields manually before confirming.'
            : 'Matches against past invoice history to auto-fill contact, account code, tax type etc.'}
        </p>
      </div>
    </div>
  );
}
