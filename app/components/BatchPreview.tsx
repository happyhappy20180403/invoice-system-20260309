'use client';

import { useState, useCallback } from 'react';
import {
  batchCreateInvoicesAction,
  type BatchRowWithMatch,
  type BatchSubmitResult,
} from '@/app/actions/batch';
import BatchResultBar from './BatchResultBar';

interface Props {
  rows: BatchRowWithMatch[];
  onBack: () => void;
}

const LOW_SCORE_THRESHOLD = 0.7;

function downloadCsv(results: BatchSubmitResult[], rows: BatchRowWithMatch[]) {
  const header = 'Row,Date,Project,UnitNo,Description,Price,ContactName,AccountCode,Status,InvoiceID,InvoiceNumber,Error';
  const lines = results.map(r => {
    const row = rows.find(row => row.rowIndex === r.rowIndex);
    const cols = [
      r.rowIndex + 1,
      row?.date ?? '',
      `"${row?.project ?? ''}"`,
      `"${row?.unitNo ?? ''}"`,
      `"${row?.description ?? ''}"`,
      row?.finalPrice ?? '',
      `"${row?.contactName ?? ''}"`,
      row?.accountCode ?? '',
      r.success ? 'SUCCESS' : 'FAILED',
      r.invoiceId ?? '',
      r.invoiceNumber ?? '',
      `"${r.error ?? ''}"`,
    ];
    return cols.join(',');
  });

  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-invoice-results-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchPreview({ rows, onBack }: Props) {
  const [editedRows, setEditedRows] = useState<BatchRowWithMatch[]>(rows);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(rows.map(r => r.rowIndex)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BatchSubmitResult[] | null>(null);
  const [retryIndices, setRetryIndices] = useState<number[]>([]);

  const updateRow = useCallback((rowIndex: number, field: keyof BatchRowWithMatch, value: string | number) => {
    setEditedRows(prev =>
      prev.map(r => r.rowIndex === rowIndex ? { ...r, [field]: value } : r),
    );
  }, []);

  const toggleSelect = useCallback((rowIndex: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected(prev =>
      prev.size === editedRows.length
        ? new Set()
        : new Set(editedRows.map(r => r.rowIndex)),
    );
  }, [editedRows]);

  const runSubmit = useCallback(async (indices?: number[]) => {
    setIsSubmitting(true);
    setResults(null);
    try {
      const result = await batchCreateInvoicesAction(editedRows, indices);
      setResults(result);
    } catch (err) {
      setResults([{ rowIndex: -1, success: false, error: String(err) }]);
    } finally {
      setIsSubmitting(false);
    }
  }, [editedRows]);

  const handleRetry = useCallback(async () => {
    if (retryIndices.length === 0) return;
    setIsSubmitting(true);
    try {
      const retryResult = await batchCreateInvoicesAction(editedRows, retryIndices);
      setResults(prev => {
        if (!prev) return retryResult;
        const merged = [...prev];
        for (const r of retryResult) {
          const idx = merged.findIndex(m => m.rowIndex === r.rowIndex);
          if (idx >= 0) merged[idx] = r;
          else merged.push(r);
        }
        return merged;
      });
      setRetryIndices([]);
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [editedRows, retryIndices]);

  const failedIndices = results?.filter(r => !r.success && r.rowIndex >= 0).map(r => r.rowIndex) ?? [];

  return (
    <div className="space-y-4">
      <BatchResultBar
        results={results}
        rows={editedRows}
        selected={selected}
        isSubmitting={isSubmitting}
        retryIndices={retryIndices}
        onSubmitSelected={() => runSubmit(Array.from(selected))}
        onSubmitAll={() => runSubmit()}
        onSelectFailed={() => setRetryIndices(failedIndices)}
        onRetry={handleRetry}
        onDownloadCsv={() => results && downloadCsv(results, editedRows)}
        onBack={onBack}
      />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === editedRows.length && editedRows.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Project / Unit</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3">Contact Name</th>
              <th className="px-3 py-3">Acct Code</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {editedRows.map(row => {
              const result = results?.find(r => r.rowIndex === row.rowIndex);
              const isLowScore = row.score < LOW_SCORE_THRESHOLD;
              const isRetrying = retryIndices.includes(row.rowIndex);

              const rowBg = result?.success
                ? 'bg-green-50'
                : result && !result.success
                ? 'bg-red-50'
                : isRetrying
                ? 'bg-orange-50'
                : isLowScore
                ? 'bg-yellow-50'
                : '';

              return (
                <tr key={row.rowIndex} className={`border-b last:border-0 transition ${rowBg}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.rowIndex)}
                      onChange={() => toggleSelect(row.rowIndex)}
                      disabled={!!results}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-400">{row.rowIndex + 1}</td>
                  <td className="px-3 py-2 text-xs">{row.date}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.project}</div>
                    <div className="text-xs text-gray-500">{row.unitNo}</div>
                  </td>
                  <td className="max-w-40 px-3 py-2">
                    <div className="truncate text-xs" title={row.description}>{row.description}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {row.finalPrice.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.contactName}
                      onChange={e => updateRow(row.rowIndex, 'contactName', e.target.value)}
                      disabled={!!results}
                      className="w-32 rounded border border-gray-200 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none disabled:border-transparent disabled:bg-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.accountCode}
                      onChange={e => updateRow(row.rowIndex, 'accountCode', e.target.value)}
                      disabled={!!results}
                      className="w-20 rounded border border-gray-200 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none disabled:border-transparent disabled:bg-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isLowScore ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {(row.score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {result ? (
                      result.success ? (
                        <div>
                          <span className="text-xs font-semibold text-green-600">Created</span>
                          <div className="text-xs text-gray-400">{result.invoiceNumber || result.invoiceId}</div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-semibold text-red-600">Failed</span>
                          <div className="max-w-32 truncate text-xs text-red-400" title={result.error}>{result.error}</div>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!results && editedRows.some(r => r.score < LOW_SCORE_THRESHOLD) && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <span className="font-semibold">Warning:</span> Rows highlighted in yellow have a match score below 70%.
          Please verify the Contact Name and Account Code before submitting.
        </div>
      )}
    </div>
  );
}
