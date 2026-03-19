import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getValidToken } from '@/lib/xero/token-manager';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const xeroUserId = (session as any).xeroUserId;
    const token = await getValidToken(xeroUserId);
    if (!token) {
      return NextResponse.json({ error: 'No Xero token' }, { status: 401 });
    }

    const res = await fetch('https://api.xero.com/api.xro/2.0/TaxRates', {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'xero-tenant-id': token.tenantId,
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    const rates = (data.TaxRates || []).map((r: any) => ({
      name: r.Name,
      taxType: r.TaxType,
      rate: r.EffectiveRate,
      status: r.Status,
      canApplyToRevenue: r.CanApplyToRevenue,
    }));

    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
