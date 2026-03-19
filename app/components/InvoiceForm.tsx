'use client';

import { useState, useCallback } from 'react';
import { fuzzyMatchAction, getTrackingOptionsAction } from '@/app/actions/match';
import type { PreviewData } from './InvoiceDashboard';

interface Props {
  onPreview: (data: PreviewData) => void;
}

export default function InvoiceForm({ onPreview }: Props) {
  const d = new Date();
  const todayDMY = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const [date, setDate] = useState(todayDMY);
  const [project, setProject] = useState('');
  const [unitNo, setUnitNo] = useState('');
  const [description, setDescription] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [isMatching, setIsMatching] = useState(false);

  const handlePreview = useCallback(async () => {
    if (!project || !unitNo || !description || !finalPrice) return;

    setIsMatching(true);
    try {
      const suggestions = await fuzzyMatchAction(project, unitNo, description);
      const bestMatch = suggestions[0];

      // Due date = last day of same month (date is DD/MM/YYYY)
      const dateParts = date.split('/');
      let dueDateStr = date;
      if (dateParts.length === 3) {
        const [, mm, yyyy] = dateParts.map(Number);
        const lastDay = new Date(yyyy, mm, 0).getDate();
        dueDateStr = `${String(lastDay).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
      }

      const previewData: PreviewData = {
        date,
        dueDate: dueDateStr,
        project,
        unitNo,
        description,
        finalPrice: parseFloat(finalPrice),
        contactName: bestMatch?.contactName ?? '',
        accountCode: bestMatch?.accountCode ?? '',
        taxType: bestMatch?.taxType ?? 'NONE',
        invoiceType: bestMatch?.invoiceType ?? 'ACCREC',
        trackingOption1: bestMatch?.trackingOption1 ?? '',
        trackingOption2: bestMatch?.trackingOption2 ?? '',
        reference: bestMatch?.reference ?? '',
        quantity: bestMatch?.quantity ?? 1,
        unitAmount: bestMatch?.unitAmount,
        suggestions,
      };

      onPreview(previewData);
    } catch (error) {
      console.error('Match failed:', error);
      alert('Failed to match. Check console for details.');
    } finally {
      setIsMatching(false);
    }
  }, [date, project, unitNo, description, finalPrice, onPreview]);

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold">New Invoice</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            type="text"
            value={date}
            onChange={e => setDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Project
          </label>
          <input
            type="text"
            value={project}
            onChange={e => setProject(e.target.value)}
            placeholder="e.g. MOLEK PINE"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Unit No
          </label>
          <input
            type="text"
            value={unitNo}
            onChange={e => setUnitNo(e.target.value)}
            placeholder="e.g. A-12-03"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Detail / Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Management Fee - March 2026"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Final Price (MYR)
          </label>
          <input
            type="number"
            value={finalPrice}
            onChange={e => setFinalPrice(e.target.value)}
            step="0.01"
            min="0"
            placeholder="e.g. 11700.00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={isMatching || !project || !unitNo || !description || !finalPrice}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isMatching ? 'Matching...' : 'Preview Invoice'}
        </button>
      </div>
    </div>
  );
}
