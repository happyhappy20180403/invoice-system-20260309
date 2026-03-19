'use client';

import { useState } from 'react';
import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview';
import BatchInput from './BatchInput';
import BatchPreview from './BatchPreview';
import FileUpload from './FileUpload';
import type { InvoiceFormData } from '@/app/actions/invoice';
import type { BatchRowWithMatch } from '@/app/actions/batch';
import type { ParsedItem } from '@/lib/ocr/parser';
import { fuzzyMatchAction } from '@/app/actions/match';

export type PreviewData = InvoiceFormData & {
  suggestions: Array<{
    contactName: string;
    emailAddress: string;
    accountCode: string;
    taxType: string;
    trackingOption1: string;
    trackingOption2: string;
    reference: string;
    invoiceType: string;
    unitAmount: number;
    quantity: number;
    score: number;
  }>;
};

type Tab = 'single' | 'batch' | 'ocr';
type BatchPhase = 'input' | 'preview';
type OcrPhase = 'upload' | 'matching' | 'batch-preview';

export default function InvoiceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('single');

  // Single invoice state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<{
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  // Batch state
  const [batchPhase, setBatchPhase] = useState<BatchPhase>('input');
  const [batchRows, setBatchRows] = useState<BatchRowWithMatch[]>([]);

  // OCR state
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>('upload');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrBatchRows, setOcrBatchRows] = useState<BatchRowWithMatch[]>([]);
  const [ocrCreatedCount, setOcrCreatedCount] = useState(0);

  // Single handlers
  const handlePreview = (data: PreviewData) => {
    setPreviewData(data);
    setCreatedInvoice(null);
  };
  const handleCreated = (result: { invoiceId: string; invoiceNumber: string }) => {
    setCreatedInvoice(result);
    setPreviewData(null);
  };
  const handleBack = () => setPreviewData(null);

  // Batch handlers
  const handleBatchMatched = (rows: BatchRowWithMatch[]) => {
    setBatchRows(rows);
    setBatchPhase('preview');
  };
  const handleBatchBack = () => setBatchPhase('input');

  // OCR handlers — skip review, go directly to batch preview
  const handleOcrComplete = async (result: {
    uploadId: number;
    filename: string;
    rawText: string;
    items: ParsedItem[];
    isMock: boolean;
    ocrMethod?: string;
    warnings?: string[];
  }) => {
    setOcrError(null);
    setOcrPhase('matching');

    try {
      // Run fuzzy matching on each OCR item directly
      const rows: BatchRowWithMatch[] = [];
      for (let idx = 0; idx < result.items.length; idx++) {
        const item = result.items[idx];
        const amount = item.amount ?? 0;
        if (amount <= 0) continue; // skip items with no amount

        const suggestions = await fuzzyMatchAction(item.project, item.unitNo, item.description);
        const best = suggestions[0];

        // Calculate due date (last day of same month)
        const [year, month] = item.date.split('-').map(Number);
        const dueDate = new Date(year, month, 0);

        rows.push({
          date: item.date,
          project: item.project,
          unitNo: item.unitNo,
          description: item.description,
          finalPrice: amount,
          rowIndex: idx,
          matches: suggestions,
          contactName: best?.contactName ?? '',
          accountCode: best?.accountCode ?? '',
          taxType: best?.taxType ?? 'NONE',
          invoiceType: best?.invoiceType || 'ACCREC',
          trackingOption1: best?.trackingOption1 ?? '',
          trackingOption2: best?.trackingOption2 ?? '',
          reference: best?.reference ?? '',
          quantity: best?.quantity ?? 1,
          dueDate: dueDate.toISOString().slice(0, 10),
          score: best?.score ?? 0,
        });
      }

      setOcrBatchRows(rows);
      setOcrCreatedCount(0);
      setOcrPhase('batch-preview');
    } catch (err) {
      setOcrError(`Matching failed: ${String(err)}`);
      setOcrPhase('upload');
    }
  };
  const handleOcrError = (message: string) => setOcrError(message);
  const resetOcr = () => {
    setOcrPhase('upload');
    setOcrError(null);
    setOcrBatchRows([]);
    setOcrCreatedCount(0);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'single', label: 'Single Invoice' },
    { key: 'batch', label: 'Batch Input' },
    { key: 'ocr', label: 'OCR Upload' },
  ];

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key !== 'ocr') resetOcr();
            }}
            className={[
              'rounded-md px-5 py-2 text-sm font-medium transition',
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== Single Invoice Tab ===== */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <InvoiceForm onPreview={handlePreview} />
            {createdInvoice && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="font-semibold text-green-800">Invoice Created!</h3>
                <p className="text-sm text-green-700">
                  Invoice Number: {createdInvoice.invoiceNumber ?? 'Assigned by Xero'}
                </p>
                <p className="text-xs text-green-600">ID: {createdInvoice.invoiceId}</p>
                <p className="mt-1 text-xs text-green-600">
                  Status: DRAFT (review in Xero before approving)
                </p>
              </div>
            )}
          </div>
          <div>
            {previewData ? (
              <InvoicePreview data={previewData} onBack={handleBack} onCreated={handleCreated} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
                <p className="text-gray-400">Fill in the form and click Preview to see the invoice</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Batch Input Tab ===== */}
      {activeTab === 'batch' && (
        <>
          {batchPhase === 'input' && <BatchInput onMatched={handleBatchMatched} />}
          {batchPhase === 'preview' && batchRows.length > 0 && (
            <BatchPreview rows={batchRows} onBack={handleBatchBack} />
          )}
        </>
      )}

      {/* ===== OCR Upload Tab ===== */}
      {activeTab === 'ocr' && (
        <>
          {/* Upload phase */}
          {ocrPhase === 'upload' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Upload Document</h2>
                <p className="mb-5 text-sm text-gray-500">
                  Upload a PDF or image of your repair work order. OCR extracts
                  line items and auto-matches contacts from history.
                </p>
                {ocrCreatedCount > 0 && (
                  <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {ocrCreatedCount} invoice{ocrCreatedCount !== 1 ? 's' : ''} created successfully.
                  </div>
                )}
                <FileUpload onOcrComplete={handleOcrComplete} onError={handleOcrError} />
                {ocrError && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ocrError}</div>
                )}
              </div>
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-8">
                <div className="space-y-4 text-sm text-gray-500">
                  <h3 className="text-base font-semibold text-gray-700">How it works</h3>
                  <ol className="list-inside list-decimal space-y-2">
                    <li>Upload your repair work order (PDF or image)</li>
                    <li>Review extracted items with auto-matched contacts</li>
                    <li>Edit any fields that need correction</li>
                    <li>Submit to create DRAFT invoices in Xero</li>
                  </ol>
                  <p className="text-xs text-gray-400">Supported: PDF, JPG, PNG (max 10 MB)</p>
                </div>
              </div>
            </div>
          )}

          {/* Matching phase — loading indicator */}
          {ocrPhase === 'matching' && (
            <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 shadow-sm">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm font-medium text-gray-700">Matching with invoice history...</p>
              <p className="mt-1 text-xs text-gray-400">Auto-filling contacts, accounts, and tracking categories</p>
            </div>
          )}

          {/* Batch preview phase — full width table with bulk submit */}
          {ocrPhase === 'batch-preview' && ocrBatchRows.length > 0 && (
            <BatchPreview rows={ocrBatchRows} onBack={resetOcr} />
          )}
        </>
      )}
    </div>
  );
}
