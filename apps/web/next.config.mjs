const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const isDev = process.env.NODE_ENV !== 'production';
// Card payments (MercadoPago.js Secure Fields) need a few extra origins; without a public key the
// store is Pix-only and the policy stays as tight as before.
// NOTE: confirm this list against the browser console in the Mercado Pago sandbox before launch.
const cardEnabled = Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
const mp = ['https://*.mercadopago.com', 'https://*.mercadolibre.com', 'https://*.mlstatic.com'];
const extra = (origins) => (cardEnabled ? ` ${origins.join(' ')}` : '');

// Next.js needs inline scripts/styles for hydration; everything else is locked to this origin.
// ViaCEP is the only external API the browser calls (address lookup at checkout).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${extra(['https://sdk.mercadopago.com', ...mp])}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://viacep.com.br${extra(mp)}${isDev ? ' ws:' : ''}`,
  `frame-src 'self'${extra(mp)}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Search engines and audit tools must see <title> and meta tags in the initial <head>,
  // not streamed later in the body.
  htmlLimitedBots: /.*/,
  transpilePackages: ['@mon-cher-savon/ui-tokens', '@mon-cher-savon/contracts'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // The browser talks to one origin: the session cookie is first-party and CORS is not needed.
    return [
      { source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
