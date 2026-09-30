
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'v2.exercisedb.io',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'static.exercisedb.dev',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'] // generic
};

export default nextConfig;
