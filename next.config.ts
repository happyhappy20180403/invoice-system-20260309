import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xero-node', 'mupdf', 'tesseract.js', 'pdf-parse'],
};

export default nextConfig;
