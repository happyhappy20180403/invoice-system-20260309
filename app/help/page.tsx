import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Help & Guide - Xero Invoice Auto-Input',
  description: 'Staff guide for using the Invoice Auto-Input system',
};

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Help &amp; Guide</h1>
          </div>
          <span className="text-sm text-gray-500">{session.user.name ?? session.user.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24 rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Contents
              </p>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="#getting-started" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    Getting Started
                  </a>
                </li>
                <li>
                  <a href="#single-invoice" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    Single Invoice Input
                  </a>
                </li>
                <li>
                  <a href="#batch-input" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    Batch Input
                  </a>
                </li>
                <li>
                  <a href="#ocr-upload" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    OCR Upload
                  </a>
                </li>
                <li>
                  <a href="#troubleshooting" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    Troubleshooting
                  </a>
                </li>
                <li>
                  <a href="#faq" className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100 hover:text-blue-600">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="min-w-0 flex-1 space-y-10">

            {/* Getting Started */}
            <section id="getting-started" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Getting Started</h2>

              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Logging in to Xero</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>Open this application and sign in with your Google account.</li>
                    <li>On the dashboard, check the <strong>Xero Connection</strong> status indicator at the top.</li>
                    <li>If the status shows <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Disconnected</span>, click <strong>Connect Xero</strong> and complete the OAuth flow in the popup window.</li>
                    <li>Once connected, the indicator turns <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Connected</span> and you are ready to create invoices.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">First-Time Setup</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>Ask your administrator to add your Google account to the allowed-users list.</li>
                    <li>Confirm that the Xero organisation displayed in the header matches your company.</li>
                    <li>Run a test invoice in <em>Single Invoice Input</em> mode to verify the connection end-to-end before going live.</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Single Invoice Input */}
            <section id="single-invoice" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Single Invoice Input</h2>

              <div className="space-y-5">
                <p className="text-sm text-gray-600">
                  Use this mode when you need to create one invoice at a time with full control over every field.
                </p>

                <div>
                  <h3 className="mb-3 font-semibold text-gray-800">Field Reference</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="rounded-tl-md px-3 py-2 font-semibold text-gray-700">Field</th>
                          <th className="px-3 py-2 font-semibold text-gray-700">Description</th>
                          <th className="rounded-tr-md px-3 py-2 font-semibold text-gray-700">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-900">Date</td>
                          <td className="px-3 py-2 text-gray-600">Invoice date (DD/MM/YYYY)</td>
                          <td className="px-3 py-2 text-gray-500">Defaults to today</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-900">Project</td>
                          <td className="px-3 py-2 text-gray-600">Client / project name</td>
                          <td className="px-3 py-2 text-gray-500">Auto-complete enabled</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-900">Unit No</td>
                          <td className="px-3 py-2 text-gray-600">Property or unit identifier</td>
                          <td className="px-3 py-2 text-gray-500">Auto-complete enabled</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-900">Description</td>
                          <td className="px-3 py-2 text-gray-600">Line-item description for Xero</td>
                          <td className="px-3 py-2 text-gray-500">Free text</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-gray-900">Final Price</td>
                          <td className="px-3 py-2 text-gray-600">Invoice amount in MYR</td>
                          <td className="px-3 py-2 text-gray-500">Numeric, no currency symbol</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">How Auto-Complete Works</h3>
                  <p className="text-sm text-gray-700">
                    As you type in the <strong>Project</strong> or <strong>Unit No</strong> fields the system performs a fuzzy search
                    against your historical invoice data. Select a suggestion from the dropdown to populate the field.
                    The match score is shown next to each suggestion — scores above 80% are highlighted in green.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Preview &amp; Confirm</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>After filling all fields, click <strong>Preview</strong> to review the invoice details.</li>
                    <li>Verify the Contact name, line-item description, and total amount are correct.</li>
                    <li>If anything is wrong, click <strong>Edit</strong> to go back and correct it.</li>
                    <li>Click <strong>Create DRAFT</strong> to send the invoice to Xero as a draft. No money moves until it is approved in Xero.</li>
                  </ol>
                </div>

                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Tip:</strong> The &ldquo;Create DRAFT&rdquo; button only creates a draft in Xero. You must go to the Xero web interface to approve and send it to the client.
                </div>
              </div>
            </section>

            {/* Batch Input */}
            <section id="batch-input" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Batch Input</h2>

              <div className="space-y-5">
                <p className="text-sm text-gray-600">
                  Use Batch Input to create multiple invoices at once by pasting data from a spreadsheet.
                </p>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Accepted Format</h3>
                  <p className="mb-2 text-sm text-gray-700">
                    Copy exactly <strong>5 columns</strong> from Excel or Google Sheets and paste into the batch text area.
                    Columns must be in this order, separated by tabs:
                  </p>
                  <div className="rounded-md bg-gray-900 px-4 py-3 text-sm">
                    <code className="text-green-400">Date&nbsp;&nbsp;&nbsp;&nbsp;Project&nbsp;&nbsp;&nbsp;&nbsp;Unit No&nbsp;&nbsp;&nbsp;&nbsp;Description&nbsp;&nbsp;&nbsp;&nbsp;Final Price</code>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Each row becomes one invoice. Blank rows are ignored.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Pasting Steps</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>Select your data range in Excel / Google Sheets (including header row is optional — the system auto-detects it).</li>
                    <li>Copy with <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">Ctrl+C</kbd> / <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">Cmd+C</kbd>.</li>
                    <li>Click inside the <strong>Batch Paste</strong> area and press <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">Ctrl+V</kbd> / <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">Cmd+V</kbd>.</li>
                    <li>Click <strong>Parse &amp; Match</strong> to run the fuzzy matching for Project and Unit No.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Reviewing Matches</h3>
                  <p className="mb-2 text-sm text-gray-700">
                    After parsing, each row shows its matched Contact in Xero with a confidence score.
                    Rows highlighted in <span className="rounded bg-yellow-100 px-1 text-yellow-800">yellow</span> have a low-confidence match — review and correct them before submitting.
                  </p>
                  <p className="text-sm text-gray-700">
                    You can edit any cell inline by clicking on it.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Partial Submission</h3>
                  <p className="text-sm text-gray-700">
                    Use the checkboxes on the left of each row to select only the rows you want to submit.
                    Uncheck any rows with errors or that require further review, then click <strong>Create Selected as DRAFTs</strong>.
                    Unchecked rows remain in the table so you can fix and resubmit them.
                  </p>
                </div>
              </div>
            </section>

            {/* OCR Upload */}
            <section id="ocr-upload" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">OCR Upload</h2>

              <div className="space-y-5">
                <p className="text-sm text-gray-600">
                  Upload scanned documents or photos and the system will extract invoice data automatically using OCR.
                </p>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Supported File Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {['PDF', 'JPG', 'JPEG', 'PNG'].map((fmt) => (
                      <span key={fmt} className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                        {fmt}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Maximum file size: 10 MB per file.</p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Upload Steps</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>Click <strong>OCR Upload</strong> tab on the dashboard.</li>
                    <li>Drag and drop your file onto the upload area, or click <strong>Browse</strong> to select it.</li>
                    <li>Wait for the upload and OCR processing to complete (typically 5–15 seconds).</li>
                    <li>The system displays extracted fields — Date, Project, Unit No, Description, and Final Price.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Reviewing &amp; Correcting OCR Results</h3>
                  <p className="mb-2 text-sm text-gray-700">
                    OCR is not 100% accurate. Always verify the extracted values before creating the invoice:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    <li>Fields with low confidence are highlighted in <span className="rounded bg-orange-100 px-1 text-orange-800">orange</span>.</li>
                    <li>Click any field to edit it directly.</li>
                    <li>The original document thumbnail remains visible on the right for reference.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-800">Submitting to Xero</h3>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                    <li>After correcting all fields, click <strong>Preview</strong> to see the final invoice.</li>
                    <li>Confirm all details, then click <strong>Create DRAFT</strong>.</li>
                    <li>The system uploads the source document as an attachment to the Xero invoice automatically.</li>
                  </ol>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>Note:</strong> For best OCR accuracy, use clear scans at 200 DPI or higher. Handwritten text may not be recognised reliably.
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">Troubleshooting</h2>

              <div className="space-y-4">

                <div className="rounded-md border border-gray-100 p-4">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    <span className="mr-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Error</span>
                    &ldquo;Xero connection failed&rdquo;
                  </h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                    <li>Click <strong>Connect Xero</strong> in the header and re-authorise the application.</li>
                    <li>Ensure pop-ups are not blocked by your browser for this site.</li>
                    <li>If the problem persists, sign out and sign back in, then reconnect Xero.</li>
                    <li>Contact your administrator if the error continues.</li>
                  </ol>
                </div>

                <div className="rounded-md border border-gray-100 p-4">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    <span className="mr-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Error</span>
                    &ldquo;Token expired&rdquo;
                  </h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                    <li>The Xero OAuth token has a limited lifetime. Click <strong>Reconnect Xero</strong> — the token refreshes automatically in most cases.</li>
                    <li>If manual reconnection is required, click <strong>Connect Xero</strong> and complete the authorisation flow again.</li>
                    <li>Your unsaved invoice data is preserved during reconnection — do not close the tab.</li>
                  </ol>
                </div>

                <div className="rounded-md border border-gray-100 p-4">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    <span className="mr-2 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">Issue</span>
                    Auto-complete accuracy is low
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    <li>Try typing more characters to narrow the search.</li>
                    <li>Use the exact spelling as it appears in Xero (check the Xero Contacts page).</li>
                    <li>New contacts added to Xero may take up to 10 minutes to appear in auto-complete due to cache refresh.</li>
                    <li>If a contact is missing entirely, add it manually in Xero first, then retry.</li>
                  </ul>
                </div>

                <div className="rounded-md border border-gray-100 p-4">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    <span className="mr-2 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">Issue</span>
                    Rate limit error (HTTP 429)
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    <li>Xero enforces a limit of 60 API calls per minute per organisation.</li>
                    <li>Wait 60 seconds and try again. The system will retry automatically in most cases.</li>
                    <li>For large batch submissions (&gt;30 invoices), the system automatically throttles requests — this is normal and not an error.</li>
                  </ul>
                </div>

              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-900">FAQ</h2>

              <div className="space-y-2">

                <details className="group rounded-md border border-gray-200">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                    <span>How do I approve a DRAFT invoice?</span>
                    <span className="ml-2 shrink-0 text-gray-400 transition-transform group-open:rotate-90">&#9654;</span>
                  </summary>
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    DRAFT invoices are created in Xero but are not sent to the client. To approve them, log in to
                    the <strong>Xero web interface</strong>, navigate to <em>Accounts &rarr; Sales &rarr; Invoices</em>,
                    find the draft, and click <strong>Approve</strong>. You can then email it to the client from there.
                  </div>
                </details>

                <details className="group rounded-md border border-gray-200">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                    <span>How do I fix or delete an invoice I created by mistake?</span>
                    <span className="ml-2 shrink-0 text-gray-400 transition-transform group-open:rotate-90">&#9654;</span>
                  </summary>
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    This application creates invoices as DRAFTs and does not support editing or deleting them directly.
                    Go to the <strong>Xero web interface</strong> and find the invoice. On a DRAFT invoice you can click
                    <strong> Edit</strong> to modify it or <strong>Void / Delete</strong> to remove it. Approved invoices
                    must be voided, not deleted.
                  </div>
                </details>

                <details className="group rounded-md border border-gray-200">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                    <span>What currencies are supported?</span>
                    <span className="ml-2 shrink-0 text-gray-400 transition-transform group-open:rotate-90">&#9654;</span>
                  </summary>
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    Currently only <strong>MYR (Malaysian Ringgit)</strong> is supported. All invoice amounts are treated
                    as MYR. Multi-currency support may be added in a future release.
                  </div>
                </details>

                <details className="group rounded-md border border-gray-200">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                    <span>Can I create invoices for contacts that are not in Xero yet?</span>
                    <span className="ml-2 shrink-0 text-gray-400 transition-transform group-open:rotate-90">&#9654;</span>
                  </summary>
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    No. The system requires contacts to exist in Xero before an invoice can be created for them.
                    Add the new contact in Xero first, wait a few minutes for the cache to refresh, then create
                    the invoice here.
                  </div>
                </details>

                <details className="group rounded-md border border-gray-200">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                    <span>Is my data saved if I accidentally close the browser tab?</span>
                    <span className="ml-2 shrink-0 text-gray-400 transition-transform group-open:rotate-90">&#9654;</span>
                  </summary>
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    Unsaved form data is <strong>not</strong> automatically preserved. Invoices that have already been
                    submitted as DRAFTs to Xero are safe and will not be lost. For batch input, copy your data again
                    from the spreadsheet and re-paste it.
                  </div>
                </details>

              </div>
            </section>

            {/* Footer */}
            <div className="pb-4 text-center text-xs text-gray-400">
              Need more help? Contact your system administrator.
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
