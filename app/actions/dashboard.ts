'use server';

import { db } from '@/lib/db';
import { apiMetrics, createdInvoices, xeroTokens } from '@/lib/db/schema';
import { desc, gte, sql, and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricsSummary {
  todayCount: number;
  todaySuccessRate: number;
  avgResponseTimeMs: number;
  totalCalls24h: number;
}

export interface SloStatus {
  availability: { target: number; actual: number; passing: boolean };
  latencyP95Ms: { target: number; actual: number; passing: boolean };
  apiSuccessRate: { target: number; actual: number; passing: boolean };
}

export interface RecentApiCall {
  id: number;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  timestamp: number | null;
}

export interface TokenHealth {
  connected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: number | null;
  remainingSeconds: number | null;
  refreshTokenExpiresAt: number | null;
}

export interface DailyInvoiceCount {
  date: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayUnix(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function unixDaysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getMetricsSummary(): Promise<MetricsSummary> {
  const todayStart = todayUnix();
  const dayAgo = unixDaysAgo(1);

  // Today invoice count from createdInvoices
  const todayCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(createdInvoices)
    .where(gte(createdInvoices.createdAt, todayStart))
    .get();

  const todayCount = todayCountResult?.count ?? 0;

  // API calls in last 24h
  const calls24h = await db
    .select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when status_code >= 200 and status_code < 300 then 1 else 0 end)`,
      avgMs: sql<number>`avg(response_time_ms)`,
    })
    .from(apiMetrics)
    .where(gte(apiMetrics.timestamp, dayAgo))
    .get();

  const totalCalls24h = calls24h?.total ?? 0;
  const successCount = calls24h?.success ?? 0;
  const avgResponseTimeMs = Math.round(calls24h?.avgMs ?? 0);
  const todaySuccessRate =
    totalCalls24h > 0 ? Math.round((successCount / totalCalls24h) * 1000) / 10 : 100;

  return { todayCount, todaySuccessRate, avgResponseTimeMs, totalCalls24h };
}

export async function getRecentApiCalls(limit = 20): Promise<RecentApiCall[]> {
  const rows = await db
    .select()
    .from(apiMetrics)
    .orderBy(desc(apiMetrics.timestamp))
    .limit(limit)
    .all();

  return rows;
}

export async function getSloStatus(): Promise<SloStatus> {
  const windowStart = unixDaysAgo(1);

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when status_code >= 200 and status_code < 300 then 1 else 0 end)`,
    })
    .from(apiMetrics)
    .where(gte(apiMetrics.timestamp, windowStart))
    .get();

  const total = stats?.total ?? 0;
  const success = stats?.success ?? 0;
  const successRate = total > 0 ? (success / total) * 100 : 100;

  // P95 latency: approximate via SQLite percentile (order by + offset)
  let p95Ms = 0;
  if (total > 0) {
    const p95Offset = Math.max(0, Math.floor(total * 0.95) - 1);
    const p95Row = await db
      .select({ ms: apiMetrics.responseTimeMs })
      .from(apiMetrics)
      .where(gte(apiMetrics.timestamp, windowStart))
      .orderBy(apiMetrics.responseTimeMs)
      .limit(1)
      .offset(p95Offset)
      .get();
    p95Ms = p95Row?.ms ?? 0;
  }

  const availabilityActual = successRate;
  const apiSuccessRateActual = successRate;

  return {
    availability: {
      target: 99.0,
      actual: Math.round(availabilityActual * 10) / 10,
      passing: availabilityActual >= 99.0,
    },
    latencyP95Ms: {
      target: 500,
      actual: p95Ms,
      passing: p95Ms <= 500,
    },
    apiSuccessRate: {
      target: 99.0,
      actual: Math.round(apiSuccessRateActual * 10) / 10,
      passing: apiSuccessRateActual >= 99.0,
    },
  };
}

export async function getTokenHealth(): Promise<TokenHealth> {
  const session = await auth();
  if (!session?.user) {
    return {
      connected: false,
      tenantId: null,
      tenantName: null,
      expiresAt: null,
      remainingSeconds: null,
      refreshTokenExpiresAt: null,
    };
  }

  const xeroUserId = (session as any).xeroUserId as string | undefined;
  if (!xeroUserId) {
    return {
      connected: false,
      tenantId: null,
      tenantName: null,
      expiresAt: null,
      remainingSeconds: null,
      refreshTokenExpiresAt: null,
    };
  }

  const token = await db
    .select()
    .from(xeroTokens)
    .where(eq(xeroTokens.userId, xeroUserId))
    .get();

  if (!token) {
    return {
      connected: false,
      tenantId: null,
      tenantName: null,
      expiresAt: null,
      remainingSeconds: null,
      refreshTokenExpiresAt: null,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = token.expiresAt ? token.expiresAt - now : null;

  return {
    connected: true,
    tenantId: token.tenantId,
    tenantName: token.tenantName,
    expiresAt: token.expiresAt,
    remainingSeconds,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
  };
}

export async function getDailyInvoiceCounts(days = 30): Promise<DailyInvoiceCount[]> {
  const since = unixDaysAgo(days);

  const rows = await db
    .select({
      date: sql<string>`date(created_at, 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(createdInvoices)
    .where(gte(createdInvoices.createdAt, since))
    .groupBy(sql`date(created_at, 'unixepoch')`)
    .orderBy(sql`date(created_at, 'unixepoch')`)
    .all();

  return rows as DailyInvoiceCount[];
}
