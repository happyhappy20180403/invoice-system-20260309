'use client';

import { useState, useCallback } from 'react';
import type { ParsedItem } from '@/lib/ocr/parser';
import type { PreviewData } from './InvoiceDashboard';
import { fuzzyMatchAction } from '@/app/actions/match';

interface OcrReviewItem extends ParsedItem {
  // Editable fields (copied from ParsedItem, kept mutable)
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
  onConfirm: (items: PreviewData[]) => void;
  onBack: () => void;
}

/** Convert a parsed item to editable state. */
function toEditable(item: ParsedItem, index: number): OcrReviewItem {
  return {
    ...item,
    editDate: item.date,
    editProject: item.project,
    editUnitNo: item.unitNo,
    editDescription: item.description,
    editAmount: item.amount !== null ? String(item.amount) : '',
    selected: true,
  };
}

/** Confidence badge colour */
function confidenceBadge(conf: number): string {
  if (conf >= 0.75) return 'bg-green-100 text-green-700';
  if (conf >= 0.45) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function OcrReview({
  uploadId,
  rawText,
  items,
  isMock,
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

  const handleConfirm = useCallback(async () => {
    if (selectedItems.length === 0) {
      setConfirmError('Please select at least one item to confirm.');
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      // Build PreviewData for each selected item via fuzzy match
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

        const dueDate = new Date(item.editDate);
        dueDate.setDate(dueDate.getDate() + 30);

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

      // Save feedback (fire-and-forget)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">OCR Review</h2>
          <p className="text-sm text-gray-500">
            {items.length} item{items.length !== 1 ? 's' : ''} detected.
            {isMock && (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                Mock OCR (no API key)
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Upload
        </button>
      </div>

      {/* Raw text toggle */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setShowRaw(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
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

      {/* Items table */}
      {editableItems.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          No items could be extracted. Please check the raw text above and enter data manually.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={editableItems.every(i => i.selected)}
                    onChange={e => toggleAll(e.target.checked)}
                    className="rounded"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Project</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Unit No</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Description</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Amount (MYR)</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editableItems.map((item, idx) => (
                <tr
                  key={idx}
                  className={item.selected ? 'bg-white' : 'bg-gray-50 opacity-60'}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={e => updateField(idx, 'selected', e.target.checked)}
                      className="rounded"
                      aria-label={`Select item ${idx + 1}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={item.editDate}
                      onChange={e => updateField(idx, 'editDate', e.target.value)}
                      disabled={!item.selected}
                      className="w-32 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.editProject}
                      onChange={e => updateField(idx, 'editProject', e.target.value)}
                      disabled={!item.selected}
                      placeholder="Project"
                      className="w-32 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.editUnitNo}
                      onChange={e => updateField(idx, 'editUnitNo', e.target.value)}
                      disabled={!item.selected}
                      placeholder="A-00-00"
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.editDescription}
                      onChange={e => updateField(idx, 'editDescription', e.target.value)}
                      disabled={!item.selected}
                      placeholder="Description"
                      className="w-48 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.editAmount}
                      onChange={e => updateField(idx, 'editAmount', e.target.value)}
                      disabled={!item.selected}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${confidenceBadge(item.confidence)}`}
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

      {/* Raw line reference */}
      {editableItems.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600">
            Show source lines
          </summary>
          <div className="mt-2 space-y-1 rounded-lg border border-gray-100 p-3">
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
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming || selectedItems.length === 0}
          className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isConfirming
            ? 'Matching...'
            : `Confirm ${selectedItems.length} Item${selectedItems.length !== 1 ? 's' : ''} & Preview`}
        </button>
      </div>
    </div>
  );
}
