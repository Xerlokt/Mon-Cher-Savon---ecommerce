const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mon-cher-savon/ui-tokens', '@mon-cher-savon/contracts'],
  images: { formats: ['image/avif', 'image/webp'] },
  async rewrites() {
    // The browser talks to one origin: the session cookie is first-party and CORS is not needed.
    return [
      { source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
