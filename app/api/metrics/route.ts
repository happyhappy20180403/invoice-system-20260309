import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import {
  getMetricsSummary,
  getSloStatus,
  getTokenHealth,
  getRecentApiCalls,
} from '@/app/actions/dashboard';

/**
 * GET /api/metrics
 * Internal endpoint: requires authenticated session.
 * Returns a JSON summary of system and API metrics.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [summary, slo, token, recentCalls] = await Promise.all([
    getMetricsSummary(),
    getSloStatus(),
    getTokenHealth(),
    getRecentApiCalls(20),
  ]);

  return NextResponse.json({ summary, slo, token, recentCalls });
}
