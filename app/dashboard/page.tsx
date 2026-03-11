import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getMetricsSummary,
  getSloStatus,
  getTokenHealth,
  getRecentApiCalls,
  getDailyInvoiceCounts,
} from '@/app/actions/dashboard';

// ---------------------------------------------------------------------------
// Small presentational helpers (pure functions, no state)
// ---------------------------------------------------------------------------

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [summary, slo, tokenHealth, recentCalls, dailyCounts] = await Promise.all([
    getMetricsSummary(),
    getSloStatus(),
    getTokenHealth(),
    getRecentApiCalls(20),
    getDailyInvoiceCounts(30),
  ]);

  const tokenExpiryDate = tokenHealth.expiresAt
    ? new Date(tokenHealth.expiresAt * 1000).toLocaleString()
    : '—';

  const remainingHours =
    tokenHealth.remainingSeconds != null
      ? (tokenHealth.remainingSeconds / 3600).toFixed(1)
      : null;

  const refreshExpiryDate = tokenHealth.refreshTokenExpiresAt
    ? new Date(tokenHealth.refreshTokenExpiresAt * 1000).toLocaleDateString()
    : '—';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <p className="text-sm text-gray-500">
            Real-time system health and API metrics
          </p>
        </div>

        {/* Summary Cards */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard
              title="Invoices Today"
              value={summary.todayCount}
              sub="DRAFT documents created"
            />
            <SummaryCard
              title="API Success Rate"
              value={`${summary.todaySuccessRate}%`}
              sub="Last 24 hours"
            />
            <SummaryCard
              title="Avg Response Time"
              value={`${summary.avgResponseTimeMs} ms`}
              sub="Last 24 hours"
            />
            <SummaryCard
              title="Total API Calls"
              value={summary.totalCalls24h}
              sub="Last 24 hours"
            />
          </div>
        </section>

        {/* SLO Status */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">SLO Status</h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">SLO</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 font-medium">Availability</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    ≥{slo.availability.target}%
                  </td>
                  <td className="px-4 py-3 text-right">{slo.availability.actual}%</td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={slo.availability.passing} label={slo.availability.passing ? 'Passing' : 'Failing'} />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Latency P95</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    ≤{slo.latencyP95Ms.target} ms
                  </td>
                  <td className="px-4 py-3 text-right">{slo.latencyP95Ms.actual} ms</td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={slo.latencyP95Ms.passing} label={slo.latencyP95Ms.passing ? 'Passing' : 'Failing'} />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">API Success Rate</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    ≥{slo.apiSuccessRate.target}%
                  </td>
                  <td className="px-4 py-3 text-right">{slo.apiSuccessRate.actual}%</td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={slo.apiSuccessRate.passing} label={slo.apiSuccessRate.passing ? 'Passing' : 'Failing'} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Token + Rate Limit Status */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
              Xero Token Status
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Connection</dt>
                <dd>
                  <StatusBadge
                    ok={tokenHealth.connected}
                    label={tokenHealth.connected ? 'Connected' : 'Disconnected'}
                  />
                </dd>
              </div>
              {tokenHealth.connected && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tenant</dt>
                    <dd className="font-medium">{tokenHealth.tenantName ?? tokenHealth.tenantId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Access Token Expires</dt>
                    <dd>{tokenExpiryDate}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Remaining</dt>
                    <dd className={remainingHours && parseFloat(remainingHours) < 0.1 ? 'text-red-600 font-medium' : ''}>
                      {remainingHours != null ? `${remainingHours}h` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Refresh Token Expires</dt>
                    <dd>{refreshExpiryDate}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
              Rate Limit (Xero)
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Limit / minute</dt>
                <dd className="font-medium">50 req</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">API calls (24h)</dt>
                <dd className="font-medium">{summary.totalCalls24h}</dd>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Rate limit tracking is in-memory per server process. For exact
                remaining count, check the Xero Developer Portal.
              </p>
            </dl>
          </div>
        </section>

        {/* Recent API Calls */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
            Recent API Calls (last 20)
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {recentCalls.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No API calls recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Endpoint</th>
                      <th className="px-4 py-3 text-left">Method</th>
                      <th className="px-4 py-3 text-right">Status</th>
                      <th className="px-4 py-3 text-right">Time (ms)</th>
                      <th className="px-4 py-3 text-left">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentCalls.map((call) => {
                      const isError = !call.statusCode || call.statusCode >= 400;
                      return (
                        <tr key={call.id} className={isError ? 'bg-red-50' : ''}>
                          <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs">
                            {call.endpoint ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{call.method ?? '—'}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`font-medium ${
                                call.statusCode && call.statusCode < 300
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {call.statusCode ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {call.responseTimeMs ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-400">
                            {call.timestamp
                              ? new Date(call.timestamp * 1000).toLocaleTimeString()
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Daily Invoice Chart (table) */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
            Daily Invoice Creation (last 30 days)
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {dailyCounts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No invoices in the last 30 days.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Invoices Created</th>
                      <th className="px-4 py-3 text-left">Bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const max = Math.max(...dailyCounts.map((r) => r.count), 1);
                      return dailyCounts.map((row) => (
                        <tr key={row.date}>
                          <td className="px-4 py-2 font-mono text-xs">{row.date}</td>
                          <td className="px-4 py-2 text-right font-medium">{row.count}</td>
                          <td className="px-4 py-2">
                            <div
                              className="h-3 rounded bg-blue-400"
                              style={{ width: `${Math.round((row.count / max) * 200)}px` }}
                            />
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
