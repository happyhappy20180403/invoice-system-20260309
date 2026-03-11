import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xero-node', 'better-sqlite3'],
};

export default nextConfig;
