import { db } from '@/lib/db';
import { apiMetrics, systemMetrics } from '@/lib/db/schema';

/**
 * Record an API call metric asynchronously (non-blocking).
 * Errors are silently swallowed so metric failures never affect core flows.
 */
export function recordApiMetric(
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  errorMessage?: string,
): void {
  // Fire-and-forget: do not await
  Promise.resolve().then(() => {
    try {
      db.insert(apiMetrics)
        .values({
          endpoint,
          method,
          statusCode,
          responseTimeMs,
          errorMessage: errorMessage ?? null,
        })
        .run();
    } catch {
      // Intentionally silent — metrics must never break the application
    }
  });
}

/**
 * Record a named system metric asynchronously (non-blocking).
 */
export function recordSystemMetric(
  metricName: string,
  metricValue: number,
  metadata?: Record<string, unknown>,
): void {
  Promise.resolve().then(() => {
    try {
      db.insert(systemMetrics)
        .values({
          metricName,
          metricValue,
          metadata: metadata ? JSON.stringify(metadata) : null,
        })
        .run();
    } catch {
      // Intentionally silent
    }
  });
}

/**
 * Wrap a Xero API fetch call and record its metrics.
 * Returns the same Response so callers are unaffected.
 */
export async function trackedFetch(
  url: string,
  options: RequestInit,
  fetchFn: (url: string, options: RequestInit) => Promise<Response>,
): Promise<Response> {
  const start = Date.now();
  let statusCode = 0;
  let errorMessage: string | undefined;

  try {
    const response = await fetchFn(url, options);
    statusCode = response.status;
    return response;
  } catch (err) {
    statusCode = 0;
    errorMessage = String(err);
    throw err;
  } finally {
    const elapsed = Date.now() - start;
    const method = (options.method ?? 'GET').toUpperCase();
    // Extract path from full URL for brevity
    let endpoint = url;
    try {
      endpoint = new URL(url).pathname;
    } catch {
      // keep full url if parse fails
    }
    recordApiMetric(endpoint, method, statusCode, elapsed, errorMessage);
  }
}
