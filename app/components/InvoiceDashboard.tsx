'use client';

import { useState } from 'react';
import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview';
import BatchInput from './BatchInput';
import BatchPreview from './BatchPreview';
import FileUpload from './FileUpload';
import OcrReview from './OcrReview';
import type { InvoiceFormData } from '@/app/actions/invoice';
import type { BatchRowWithMatch } from '@/app/actions/batch';
import type { ParsedItem } from '@/lib/ocr/parser';

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
type OcrPhase = 'upload' | 'review' | 'preview';

interface OcrResult {
  uploadId: number;
  filename: string;
  rawText: string;
  items: ParsedItem[];
  isMock: boolean;
  ocrMethod?: string;
}

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
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrPreviews, setOcrPreviews] = useState<PreviewData[]>([]);
  const [ocrPreviewIndex, setOcrPreviewIndex] = useState(0);
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

  // OCR handlers
  const handleOcrComplete = (result: OcrResult) => {
    setOcrResult(result);
    setOcrError(null);
    setOcrPhase('review');
  };
  const handleOcrError = (message: string) => setOcrError(message);
  const handleOcrConfirm = (previews: PreviewData[]) => {
    setOcrPreviews(previews);
    setOcrPreviewIndex(0);
    setOcrCreatedCount(0);
    setOcrPhase('preview');
  };
  const handleOcrItemCreated = () => {
    setOcrCreatedCount(c => c + 1);
    const nextIndex = ocrPreviewIndex + 1;
    if (nextIndex < ocrPreviews.length) {
      setOcrPreviewIndex(nextIndex);
    } else {
      setOcrPhase('upload');
      setOcrResult(null);
      setOcrPreviews([]);
    }
  };
  const handleOcrPreviewBack = () => setOcrPhase('review');
  const resetOcr = () => {
    setOcrPhase('upload');
    setOcrResult(null);
    setOcrError(null);
    setOcrPreviews([]);
    setOcrPreviewIndex(0);
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
          {/* Upload phase — 2-column layout */}
          {ocrPhase === 'upload' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Upload Document</h2>
                <p className="mb-5 text-sm text-gray-500">
                  Upload a PDF or image of your repair work order. Our OCR engine
                  will extract the line items automatically.
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
                  <h3 className="text-base font-semibold text-gray-700">How OCR Upload works</h3>
                  <ol className="list-inside list-decimal space-y-2">
                    <li>Upload your repair work order (PDF or image)</li>
                    <li>Review the automatically extracted items</li>
                    <li>Edit any fields that need correction</li>
                    <li>Confirm items to create DRAFT invoices in Xero</li>
                  </ol>
                  <p className="text-xs text-gray-400">Supported formats: PDF, JPG, PNG (max 10 MB)</p>
                </div>
              </div>
            </div>
          )}

          {/* Review phase — FULL WIDTH for the table */}
          {ocrPhase === 'review' && ocrResult && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <OcrReview
                uploadId={ocrResult.uploadId}
                rawText={ocrResult.rawText}
                items={ocrResult.items}
                isMock={ocrResult.isMock}
                ocrMethod={ocrResult.ocrMethod}
                onConfirm={handleOcrConfirm}
                onBack={resetOcr}
              />
            </div>
          )}

          {/* Preview phase — 2-column layout */}
          {ocrPhase === 'preview' && ocrPreviews.length > 0 && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Invoice {ocrPreviewIndex + 1} of {ocrPreviews.length}
                  </h2>
                  <button onClick={handleOcrPreviewBack} className="text-sm text-blue-600 hover:underline">
                    Back to Review
                  </button>
                </div>
                <InvoicePreview
                  key={ocrPreviewIndex}
                  data={ocrPreviews[ocrPreviewIndex]}
                  onBack={handleOcrPreviewBack}
                  onCreated={handleOcrItemCreated}
                />
              </div>
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-8">
                <div className="text-sm text-gray-500">
                  <h3 className="mb-2 text-base font-semibold text-gray-700">Creating Invoices</h3>
                  <p>Processing item {ocrPreviewIndex + 1} of {ocrPreviews.length}.</p>
                  {ocrCreatedCount > 0 && (
                    <p className="mt-2 font-medium text-green-600">
                      {ocrCreatedCount} created so far.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
