import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import { saveToken } from '@/lib/xero/token-manager';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Role } from '@/lib/rbac';

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: 'xero',
      name: 'Xero',
      type: 'oidc',
      issuer: 'https://identity.xero.com',
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email offline_access accounting.transactions accounting.contacts accounting.settings',
        },
      },
      profile(profile) {
        return {
          id: profile.xero_userid ?? profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.xeroUserId = account.providerAccountId;

        // Fetch tenant info and save token
        try {
          const connectionsRes = await fetch('https://api.xero.com/connections', {
            headers: { Authorization: `Bearer ${account.access_token}` },
          });
          const connections = await connectionsRes.json();
          if (connections.length > 0) {
            const tenant = connections[0];
            token.tenantId = tenant.tenantId;
            token.tenantName = tenant.tenantName;

            await saveToken(
              account.providerAccountId!,
              account.access_token!,
              account.refresh_token!,
              tenant.tenantId,
              tenant.tenantName,
              account.expires_in as number,
            );
          }
        } catch (e) {
          console.error('Failed to fetch Xero connections:', e);
        }

        // 初回ログイン時: ユーザーをDBに作成またはロールを取得
        if (profile?.email) {
          const email = profile.email as string;
          const name = (profile.name ?? profile.preferred_username ?? null) as string | null;
          const xeroUserId = account.providerAccountId ?? null;

          try {
            const existing = await db
              .select({ role: users.role })
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            if (existing.length === 0) {
              // 初回ログイン: staff ロールで作成
              await db.insert(users).values({
                email,
                name,
                role: 'staff',
                xeroUserId,
                isActive: true,
              });
              token.role = 'staff';
            } else {
              token.role = existing[0].role as Role;
            }
          } catch (e) {
            console.error('Failed to upsert user in DB:', e);
            token.role = 'staff';
          }
        }
      }

      // DB上のロールが更新された場合に備えて毎回取得する
      if (!token.role && token.email) {
        try {
          const result = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.email, token.email as string))
            .limit(1);
          token.role = result.length > 0 ? (result[0].role as Role) : 'staff';
        } catch {
          token.role = 'staff';
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).xeroUserId = token.xeroUserId;
        (session as any).tenantId = token.tenantId;
        (session as any).role = token.role ?? 'staff';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
