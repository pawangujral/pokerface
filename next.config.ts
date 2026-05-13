import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel serverless — no persistent server state
  // API routes are stateless proxies; no external DB writes
};

export default nextConfig;
