'use client';

import { useState } from 'react';
import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview';
import type { InvoiceFormData } from '@/app/actions/invoice';

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

export default function InvoiceDashboard() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<{
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  const handlePreview = (data: PreviewData) => {
    setPreviewData(data);
    setCreatedInvoice(null);
  };

  const handleCreated = (result: { invoiceId: string; invoiceNumber: string }) => {
    setCreatedInvoice(result);
    setPreviewData(null);
  };

  const handleBack = () => {
    setPreviewData(null);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <InvoiceForm onPreview={handlePreview} />

        {createdInvoice && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-800">Invoice Created!</h3>
            <p className="text-sm text-green-700">
              Invoice Number: {createdInvoice.invoiceNumber ?? 'Assigned by Xero'}
            </p>
            <p className="text-xs text-green-600">
              ID: {createdInvoice.invoiceId}
            </p>
            <p className="mt-1 text-xs text-green-600">
              Status: DRAFT (review in Xero before approving)
            </p>
          </div>
        )}
      </div>

      <div>
        {previewData ? (
          <InvoicePreview
            data={previewData}
            onBack={handleBack}
            onCreated={handleCreated}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
            <p className="text-gray-400">
              Fill in the form and click Preview to see the invoice
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
