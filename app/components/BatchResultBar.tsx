'use client';

import type { BatchRowWithMatch, BatchSubmitResult } from '@/app/actions/batch';

interface Props {
  results: BatchSubmitResult[] | null;
  rows: BatchRowWithMatch[];
  selected: Set<number>;
  isSubmitting: boolean;
  retryIndices: number[];
  onSubmitSelected: () => void;
  onSubmitAll: () => void;
  onSelectFailed: () => void;
  onRetry: () => void;
  onDownloadCsv: () => void;
  onBack: () => void;
}

export default function BatchResultBar({
  results,
  rows,
  selected,
  isSubmitting,
  retryIndices,
  onSubmitSelected,
  onSubmitAll,
  onSelectFailed,
  onRetry,
  onDownloadCsv,
  onBack,
}: Props) {
  const successCount = results?.filter(r => r.success).length ?? 0;
  const failCount = results?.filter(r => !r.success && r.rowIndex >= 0).length ?? 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
            Back to Input
          </button>
          <span className="text-sm text-gray-500">
            {rows.length} rows | {selected.size} selected
          </span>
        </div>

        {!results && (
          <div className="flex gap-2">
            <button
              onClick={onSubmitSelected}
              disabled={isSubmitting || selected.size === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? 'Submitting...' : `Submit Selected (${selected.size})`}
            </button>
            <button
              onClick={onSubmitAll}
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? 'Submitting...' : `Submit All (${rows.length})`}
            </button>
          </div>
        )}

        {results && (
          <div className="flex items-center gap-3">
            <span className="text-sm">
              <span className="font-semibold text-green-600">{successCount} succeeded</span>
              {failCount > 0 && (
                <span className="ml-2 font-semibold text-red-600">{failCount} failed</span>
              )}
            </span>
            {failCount > 0 && (
              <button
                onClick={onSelectFailed}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                Select Failed for Retry
              </button>
            )}
            {retryIndices.length > 0 && (
              <button
                onClick={onRetry}
                disabled={isSubmitting}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? 'Retrying...' : `Retry ${retryIndices.length} rows`}
              </button>
            )}
            <button
              onClick={onDownloadCsv}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Download CSV Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
