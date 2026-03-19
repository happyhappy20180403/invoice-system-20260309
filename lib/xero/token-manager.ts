import { Mutex } from 'async-mutex';
import { db } from '@/lib/db';
import { xeroTokens } from '@/lib/db/schema';
import { encrypt, decrypt } from './encrypt';
import { eq } from 'drizzle-orm';

const refreshMutex = new Mutex();

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface TokenData {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  expiresAt: number;
}

export async function saveToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tenantId: string,
  tenantName: string,
  expiresIn: number,
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const refreshTokenExpiresAt = Math.floor(Date.now() / 1000) + 60 * 24 * 3600; // 60 days

  const existing = await db.select().from(xeroTokens).where(eq(xeroTokens.userId, userId)).get();

  const data = {
    userId,
    tenantId,
    tenantName,
    encryptedAccessToken: encrypt(accessToken),
    encryptedRefreshToken: encrypt(refreshToken),
    expiresAt,
    refreshTokenExpiresAt,
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (existing) {
    await db.update(xeroTokens).set(data).where(eq(xeroTokens.userId, userId)).run();
  } else {
    await db.insert(xeroTokens).values(data).run();
  }
}

export async function getValidToken(userId: string): Promise<TokenData | null> {
  return refreshMutex.runExclusive(async () => {
    const token = await db.select().from(xeroTokens).where(eq(xeroTokens.userId, userId)).get();
    if (!token) return null;

    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = token.expiresAt! - now < TOKEN_REFRESH_BUFFER_MS / 1000;

    if (!needsRefresh) {
      return {
        accessToken: decrypt(token.encryptedAccessToken!),
        refreshToken: decrypt(token.encryptedRefreshToken!),
        tenantId: token.tenantId!,
        expiresAt: token.expiresAt!,
      };
    }

    // Proactive refresh
    const refreshToken = decrypt(token.encryptedRefreshToken!);
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.XERO_CLIENT_ID!,
        client_secret: process.env.XERO_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const result = await response.json();
    await saveToken(
      userId,
      result.access_token,
      result.refresh_token,
      token.tenantId!,
      token.tenantName!,
      result.expires_in,
    );

    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tenantId: token.tenantId!,
      expiresAt: Math.floor(Date.now() / 1000) + result.expires_in,
    };
  });
}
