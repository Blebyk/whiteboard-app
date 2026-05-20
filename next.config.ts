import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fabric.js uses browser-only APIs; exclude it from server-side bundling
  serverExternalPackages: ['better-sqlite3'],

  webpack(config) {
    // Ensure canvas-related native modules don't break server builds
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({ canvas: 'canvas' });
    }
    return config;
  },
};

export default nextConfig;
