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

  const failedIndices = results?.filter(r => !r.success && r.rowIndex >= 0).map(r => r.rowIndex) ?? [];
  const succeededIndices = new Set(results?.filter(r => r.success).map(r => r.rowIndex) ?? []);

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
    const pendingRows = editedRows.filter(r => !succeededIndices.has(r.rowIndex));
    const allPendingSelected = pendingRows.every(r => selected.has(r.rowIndex));
    if (allPendingSelected) {
      // Deselect all pending
      setSelected(prev => {
        const next = new Set(prev);
        for (const r of pendingRows) next.delete(r.rowIndex);
        return next;
      });
    } else {
      // Select all pending
      setSelected(prev => {
        const next = new Set(prev);
        for (const r of pendingRows) next.add(r.rowIndex);
        return next;
      });
    }
  }, [editedRows, selected, succeededIndices]);

  const runSubmit = useCallback(async (indices?: number[]) => {
    setIsSubmitting(true);
    try {
      const newResults = await batchCreateInvoicesAction(editedRows, indices);
      // Merge with existing results (keep previous successes, update/add new)
      setResults(prev => {
        if (!prev) return newResults;
        const merged = [...prev];
        for (const r of newResults) {
          const idx = merged.findIndex(m => m.rowIndex === r.rowIndex);
          if (idx >= 0) merged[idx] = r;
          else merged.push(r);
        }
        return merged;
      });
      // Deselect successfully submitted rows
      const succeeded = new Set(newResults.filter(r => r.success).map(r => r.rowIndex));
      if (succeeded.size > 0) {
        setSelected(prev => {
          const next = new Set(prev);
          for (const idx of succeeded) next.delete(idx);
          return next;
        });
      }
    } catch (err) {
      setResults(prev => {
        const errResult = { rowIndex: -1, success: false as const, error: String(err) };
        return prev ? [...prev, errResult] : [errResult];
      });
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

  // Compact input style
  const inputCls = (w: string) =>
    `${w} rounded border border-gray-200 px-1 py-0.5 text-xs focus:border-blue-400 focus:outline-none disabled:border-transparent disabled:bg-transparent`;

  return (
    <div className="space-y-3">
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

      <div className="rounded-xl bg-white shadow-sm">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-[11px] font-medium text-gray-500">
              <th className="w-8 px-1 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.size === editedRows.length && editedRows.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="w-7 px-1 py-2 text-center">#</th>
              <th className="w-[80px] px-1 py-2">Date</th>
              <th className="w-[100px] px-1 py-2">Project</th>
              <th className="w-[70px] px-1 py-2">Unit</th>
              <th className="px-1 py-2">Description</th>
              <th className="w-[70px] px-1 py-2 text-right">Price</th>
              <th className="w-[130px] px-1 py-2">Contact</th>
              <th className="w-[55px] px-1 py-2">Acct</th>
              <th className="w-[80px] px-1 py-2">Tax</th>
              <th className="w-[70px] px-1 py-2">Track1</th>
              <th className="w-[70px] px-1 py-2">Track2</th>
              <th className="w-[70px] px-1 py-2">Ref</th>
              <th className="w-[100px] px-1 py-2">Due</th>
              <th className="w-[40px] px-1 py-2 text-center">%</th>
              <th className="w-[70px] px-1 py-2">Status</th>
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

              const rowDone = succeededIndices.has(row.rowIndex);

              return (
                <tr key={row.rowIndex} className={`border-b last:border-0 transition ${rowBg}`}>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.rowIndex)}
                      onChange={() => toggleSelect(row.rowIndex)}
                      disabled={rowDone}
                      className="rounded"
                    />
                  </td>
                  <td className="px-1 py-1 text-center text-gray-400">{row.rowIndex + 1}</td>
                  <td className="px-1 py-1 text-[11px]">{row.date}</td>
                  <td className="px-1 py-1 truncate font-medium" title={row.project}>{row.project}</td>
                  <td className="px-1 py-1 truncate font-mono" title={row.unitNo}>{row.unitNo}</td>
                  <td className="px-1 py-1">
                    <div className="truncate" title={row.description}>{row.description}</div>
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {row.finalPrice.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.contactName}
                      onChange={e => updateRow(row.rowIndex, 'contactName', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.accountCode}
                      onChange={e => updateRow(row.rowIndex, 'accountCode', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.taxType}
                      onChange={e => updateRow(row.rowIndex, 'taxType', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.trackingOption1}
                      onChange={e => updateRow(row.rowIndex, 'trackingOption1', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.trackingOption2}
                      onChange={e => updateRow(row.rowIndex, 'trackingOption2', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="text" value={row.reference}
                      onChange={e => updateRow(row.rowIndex, 'reference', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="date" value={row.dueDate}
                      onChange={e => updateRow(row.rowIndex, 'dueDate', e.target.value)}
                      disabled={rowDone} className={inputCls('w-full')} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isLowScore ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {(row.score * 100).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    {result ? (
                      result.success ? (
                        <span className="text-[10px] font-semibold text-green-600" title={result.invoiceNumber || result.invoiceId}>
                          Created
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-red-600" title={result.error}>
                          Failed
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-gray-400">Pending</span>
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
