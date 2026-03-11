import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xero-node', 'better-sqlite3', 'mupdf', 'tesseract.js', 'pdf-parse'],
};

export default nextConfig;
