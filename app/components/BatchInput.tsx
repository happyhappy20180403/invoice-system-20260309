'use client';

import { useState, useCallback } from 'react';
import { batchMatchAction, type BatchRow, type BatchRowWithMatch } from '@/app/actions/batch';

interface Props {
  onMatched: (rows: BatchRowWithMatch[]) => void;
}

interface ParsedRow {
  rowIndex: number;
  raw: string[];
  data?: BatchRow;
  error?: string;
}

function parseDate(raw: string): string | null {
  const cleaned = raw.trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  // dd/mm/yyyy or d/m/yyyy
  const dmyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // mm/dd/yyyy
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) return null; // ambiguous, handled above
  return null;
}

function parsePastedText(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  return lines.map((line, idx) => {
    // Tab区切り（ExcelからのペーストはTab）またはCSV
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim())
      : line.split(',').map(c => c.replace(/^"|"$/g, '').trim());

    if (cols.length < 5) {
      return {
        rowIndex: idx,
        raw: cols,
        error: `Expected 5 columns (Date|Project|UnitNo|Description|FinalPrice), got ${cols.length}`,
      };
    }

    const [dateRaw, project, unitNo, description, priceRaw] = cols;

    const date = parseDate(dateRaw);
    if (!date) {
      return {
        rowIndex: idx,
        raw: cols,
        error: `Invalid date format: "${dateRaw}". Use YYYY-MM-DD or DD/MM/YYYY`,
      };
    }

    const finalPrice = parseFloat(priceRaw.replace(/,/g, ''));
    if (isNaN(finalPrice) || finalPrice <= 0) {
      return {
        rowIndex: idx,
        raw: cols,
        error: `Invalid price: "${priceRaw}". Must be a positive number`,
      };
    }

    if (!project.trim()) {
      return { rowIndex: idx, raw: cols, error: 'Project is required' };
    }
    if (!unitNo.trim()) {
      return { rowIndex: idx, raw: cols, error: 'Unit No is required' };
    }
    if (!description.trim()) {
      return { rowIndex: idx, raw: cols, error: 'Description is required' };
    }

    return {
      rowIndex: idx,
      raw: cols,
      data: { date, project, unitNo, description, finalPrice },
    };
  });
}

export default function BatchInput({ onMatched }: Props) {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = useCallback(() => {
    if (!pasteText.trim()) return;
    setParseError(null);
    const rows = parsePastedText(pasteText);
    setParsedRows(rows);
  }, [pasteText]);

  const handleMatchAll = useCallback(async () => {
    const validRows = parsedRows.filter(r => r.data).map(r => r.data!);
    if (validRows.length === 0) {
      setParseError('No valid rows to match');
      return;
    }

    setIsMatching(true);
    try {
      const matched = await batchMatchAction(validRows);
      onMatched(matched);
    } catch (err) {
      setParseError(String(err));
    } finally {
      setIsMatching(false);
    }
  }, [parsedRows, onMatched]);

  const validCount = parsedRows.filter(r => r.data).length;
  const errorCount = parsedRows.filter(r => r.error).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-xl font-semibold">Batch Input</h2>
        <p className="mb-4 text-sm text-gray-500">
          Paste rows from Excel/CSV. Format: <code className="rounded bg-gray-100 px-1 text-xs">Date | Project | UnitNo | Description | FinalPrice</code>
          <br />
          Tab-separated (Excel paste) or comma-separated. Date: YYYY-MM-DD or DD/MM/YYYY
        </p>

        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          rows={8}
          placeholder={`2026-03-01\tMOLEK PINE\tA-12-03\tManagement Fee - March 2026\t11700.00\n2026-03-01\tSUNRISE COURT\tB-05-01\tMaintenance Fee\t850.00`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="mt-3 flex gap-3">
          <button
            onClick={handleParse}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Parse
          </button>

          {parsedRows.length > 0 && (
            <button
              onClick={handleMatchAll}
              disabled={isMatching || validCount === 0}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isMatching ? 'Matching...' : `Match All (${validCount} rows)`}
            </button>
          )}
        </div>

        {parseError && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {parseError}
          </div>
        )}
      </div>

      {parsedRows.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-4">
            <h3 className="font-semibold">Parsed Rows ({parsedRows.length})</h3>
            {validCount > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {validCount} valid
              </span>
            )}
            {errorCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {errorCount} errors
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Project</th>
                  <th className="pb-2 pr-3">Unit No</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3 text-right">Price</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map(row => (
                  <tr
                    key={row.rowIndex}
                    className={`border-b last:border-0 ${row.error ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-2 pr-3 text-gray-400">{row.rowIndex + 1}</td>
                    {row.data ? (
                      <>
                        <td className="py-2 pr-3">{row.data.date.split('-').reverse().join('/')}</td>
                        <td className="py-2 pr-3">{row.data.project}</td>
                        <td className="py-2 pr-3">{row.data.unitNo}</td>
                        <td className="max-w-48 truncate py-2 pr-3" title={row.data.description}>
                          {row.data.description}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.data.finalPrice.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">OK</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-3 text-gray-400">{row.raw[0] ?? '-'}</td>
                        <td className="py-2 pr-3 text-gray-400">{row.raw[1] ?? '-'}</td>
                        <td className="py-2 pr-3 text-gray-400">{row.raw[2] ?? '-'}</td>
                        <td className="py-2 pr-3 text-gray-400">{row.raw[3] ?? '-'}</td>
                        <td className="py-2 pr-3 text-gray-400">{row.raw[4] ?? '-'}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700" title={row.error}>
                            Error
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedRows.some(r => r.error) && (
            <div className="mt-3 space-y-1">
              {parsedRows.filter(r => r.error).map(r => (
                <p key={r.rowIndex} className="text-xs text-red-600">
                  Row {r.rowIndex + 1}: {r.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
