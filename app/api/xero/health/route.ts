import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getValidToken } from '@/lib/xero/token-manager';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });
    }

    const xeroUserId = (session as any).xeroUserId;
    const token = await getValidToken(xeroUserId);

    return NextResponse.json({
      status: token ? 'connected' : 'disconnected',
      tenantId: token?.tenantId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 },
    );
  }
}
