import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Logo uploads go through server actions.
    serverActions: { bodySizeLimit: '4mb' },
  },
  // The resident pages used to live under /book; old links and notifications keep working.
  async redirects() {
    return [
      { source: '/book', destination: '/booking', permanent: true },
      { source: '/book/:path*', destination: '/booking/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
