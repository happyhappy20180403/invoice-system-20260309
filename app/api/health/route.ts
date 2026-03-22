import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await db.all(sql`SELECT 1 AS ok`);
    return NextResponse.json({ status: 'ok', db: result[0] ?? null, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: String(e) }, { status: 500 });
  }
}
