import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import { saveToken } from '@/lib/xero/token-manager';

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
    async jwt({ token, account }) {
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).xeroUserId = token.xeroUserId;
        (session as any).tenantId = token.tenantId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
