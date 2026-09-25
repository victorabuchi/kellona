import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Logo uploads go through server actions.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
