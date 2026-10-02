
import type { NextConfig } from 'next';

const localOnlyContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [{
      source: '/:path*',
      headers: [{ key: 'Content-Security-Policy', value: localOnlyContentSecurityPolicy }],
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  transpilePackages: ['geist'] // generic
};

export default nextConfig;
