import type { NextConfig } from 'next';
import path from 'node:path';

const basePath = process.env.IS_DEMO === '1' ? '/demo' : '';

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        assetPrefix: '/demo-assets',
        basePath,
        redirects: async () => [
          {
            basePath: false,
            destination: basePath,
            permanent: false,
            source: '/',
          },
        ],
      }
    : {}),
  cacheComponents: false,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  experimental: {
    appNewScrollHandler: true,
    inlineCss: true,
    prefetchInlining: true,
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [
      { hostname: 'avatar.vercel.sh' },
      {
        hostname: '*.public.blob.vercel-storage.com',
        protocol: 'https',
      },
      { hostname: 'ui-avatars.com', protocol: 'https' },
      { hostname: 'cdn.sportmonks.com', protocol: 'https' },
      { hostname: 'lh3.googleusercontent.com', protocol: 'https' },
    ],
  },
  logging: {
    fetches: { fullUrl: false },
    incomingRequests: true,
  },
  poweredByHeader: false,
  reactCompiler: true,
  // Workspace root so Turbopack finds `next` (not parent circket-mcp package-lock.json).
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
};

export default nextConfig;
