import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'gsap'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/auth/v1/:path*',
        destination: 'https://qmufalwubepttjxehvit.supabase.co/auth/v1/:path*',
      },
      {
        source: '/rest/v1/:path*',
        destination: 'https://qmufalwubepttjxehvit.supabase.co/rest/v1/:path*',
      },
      {
        source: '/storage/v1/:path*',
        destination: 'https://qmufalwubepttjxehvit.supabase.co/storage/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
