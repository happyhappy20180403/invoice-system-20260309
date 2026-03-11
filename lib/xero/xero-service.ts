import { getValidToken } from './token-manager';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

// Rate limiting: manual implementation since p-queue is ESM-only
let requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 50;

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(t => now - t < 60000);

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestInWindow = requestTimestamps[0];
    const waitMs = 60000 - (now - oldestInWindow) + 100;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  requestTimestamps.push(Date.now());
  return fetch(url, options);
}

async function xeroRequest(
  userId: string,
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
): Promise<unknown> {
  const token = await getValidToken(userId);
  if (!token) throw new Error('No valid Xero token available');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.accessToken}`,
    'xero-tenant-id': token.tenantId,
    Accept: 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await rateLimitedFetch(`${XERO_API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function getXeroContacts(userId: string): Promise<any[]> {
  const data = (await xeroRequest(userId, '/Contacts?where=IsCustomer==true&pageSize=500')) as any;
  return data.Contacts || [];
}

export async function getXeroAccountCodes(userId: string): Promise<any[]> {
  const data = (await xeroRequest(userId, '/Accounts?where=Status=="ACTIVE"')) as any;
  return data.Accounts || [];
}

export async function getXeroTrackingCategories(userId: string): Promise<any[]> {
  const data = (await xeroRequest(userId, '/TrackingCategories')) as any;
  return data.TrackingCategories || [];
}

export interface XeroInvoicePayload {
  Type: string;
  Contact: { Name: string };
  Date: string;
  DueDate: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType: string;
    Tracking?: Array<{ Name: string; Option: string }>;
  }>;
  Reference?: string;
  Status: 'DRAFT';
  LineAmountTypes?: string;
}

export async function createXeroInvoice(
  userId: string,
  invoice: XeroInvoicePayload,
): Promise<any> {
  const data = (await xeroRequest(userId, '/Invoices', 'PUT', {
    Invoices: [invoice],
  })) as any;
  return data.Invoices?.[0];
}
