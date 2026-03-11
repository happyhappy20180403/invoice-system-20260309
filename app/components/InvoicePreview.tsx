'use client';

import { useState } from 'react';
import { createInvoiceAction, createCreditNoteAction } from '@/app/actions/invoice';
import type { PreviewData } from './InvoiceDashboard';

interface Props {
  data: PreviewData;
  onBack: () => void;
  onCreated: (result: { invoiceId: string; invoiceNumber: string }) => void;
}

export default function InvoicePreview({ data, onBack, onCreated }: Props) {
  const [formState, setFormState] = useState({
    contactName: data.contactName,
    accountCode: data.accountCode,
    taxType: data.taxType,
    invoiceType: data.invoiceType,
    trackingOption1: data.trackingOption1,
    trackingOption2: data.trackingOption2,
    reference: data.reference,
    quantity: data.quantity,
    dueDate: data.dueDate,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySuggestion = (idx: number) => {
    const s = data.suggestions[idx];
    if (!s) return;
    setFormState({
      contactName: s.contactName,
      accountCode: s.accountCode,
      taxType: s.taxType,
      invoiceType: s.invoiceType,
      trackingOption1: s.trackingOption1,
      trackingOption2: s.trackingOption2,
      reference: s.reference,
      quantity: s.quantity,
      dueDate: formState.dueDate,
    });
  };

  const isCreditNote = formState.invoiceType === 'ACCRECCREDIT';

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (isCreditNote) {
        const result = await createCreditNoteAction({
          date: data.date,
          project: data.project,
          unitNo: data.unitNo,
          description: data.description,
          finalPrice: data.finalPrice,
          contactName: formState.contactName,
          accountCode: formState.accountCode,
          taxType: formState.taxType,
          reference: formState.reference,
          quantity: formState.quantity,
        });

        if (result.success) {
          onCreated({
            invoiceId: result.creditNoteId!,
            invoiceNumber: result.creditNoteNumber ?? '',
          });
        } else {
          setError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
        }
        return;
      }

      const result = await createInvoiceAction({
        date: data.date,
        dueDate: formState.dueDate,
        project: data.project,
        unitNo: data.unitNo,
        description: data.description,
        finalPrice: data.finalPrice,
        contactName: formState.contactName,
        accountCode: formState.accountCode,
        taxType: formState.taxType,
        invoiceType: formState.invoiceType,
        trackingOption1: formState.trackingOption1,
        trackingOption2: formState.trackingOption2,
        reference: formState.reference,
        quantity: formState.quantity,
      });

      if (result.success) {
        onCreated({
          invoiceId: result.invoiceId!,
          invoiceNumber: result.invoiceNumber ?? '',
        });
      } else {
        setError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Invoice Preview</h2>
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Form
        </button>
      </div>

      {/* Input fields (read-only) */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-500 uppercase">Input</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-medium">Date:</span> {data.date}</div>
          <div><span className="font-medium">Project:</span> {data.project}</div>
          <div><span className="font-medium">Unit No:</span> {data.unitNo}</div>
          <div><span className="font-medium">Price:</span> MYR {data.finalPrice.toFixed(2)}</div>
          <div className="col-span-2"><span className="font-medium">Description:</span> {data.description}</div>
        </div>
      </div>

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-500 uppercase">
            Suggestions ({data.suggestions.length})
          </h3>
          <div className="space-y-1">
            {data.suggestions.slice(0, 5).map((s, i) => (
              <button
                key={i}
                onClick={() => applySuggestion(i)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="font-medium">{s.contactName}</span>
                <span className="ml-2 text-gray-400">
                  {s.accountCode} | Score: {(s.score * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editable auto-completed fields */}
      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Auto-completed (editable)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Contact Name</label>
            <input
              type="text"
              value={formState.contactName}
              onChange={e => setFormState(s => ({ ...s, contactName: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Account Code</label>
            <input
              type="text"
              value={formState.accountCode}
              onChange={e => setFormState(s => ({ ...s, accountCode: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tax Type</label>
            <input
              type="text"
              value={formState.taxType}
              onChange={e => setFormState(s => ({ ...s, taxType: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Invoice Type</label>
            <select
              value={formState.invoiceType}
              onChange={e => setFormState(s => ({ ...s, invoiceType: e.target.value }))}
              className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
                formState.invoiceType === 'ACCRECCREDIT'
                  ? 'border-orange-300 bg-orange-50 text-orange-800 focus:border-orange-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="ACCREC">Accounts Receivable</option>
              <option value="ACCPAY">Accounts Payable</option>
              <option value="ACCRECCREDIT">Credit Note</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tracking Option 1</label>
            <input
              type="text"
              value={formState.trackingOption1}
              onChange={e => setFormState(s => ({ ...s, trackingOption1: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tracking Option 2</label>
            <input
              type="text"
              value={formState.trackingOption2}
              onChange={e => setFormState(s => ({ ...s, trackingOption2: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Reference</label>
            <input
              type="text"
              value={formState.reference}
              onChange={e => setFormState(s => ({ ...s, reference: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Due Date</label>
            <input
              type="date"
              value={formState.dueDate}
              onChange={e => setFormState(s => ({ ...s, dueDate: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isCreditNote && (
        <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          Credit Note mode: a DRAFT credit note (ACCRECCREDIT) will be created in Xero.
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !formState.contactName || !formState.accountCode}
        className={`w-full rounded-lg px-6 py-3 font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-gray-300 ${
          isCreditNote
            ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-200'
            : 'bg-green-600 hover:bg-green-700 focus:ring-green-200'
        }`}
      >
        {isSubmitting
          ? 'Creating DRAFT...'
          : isCreditNote
          ? 'Create DRAFT Credit Note in Xero'
          : 'Create DRAFT Invoice in Xero'}
      </button>
    </div>
  );
}
