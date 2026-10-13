/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mon-cher-savon/ui-tokens'],
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;
