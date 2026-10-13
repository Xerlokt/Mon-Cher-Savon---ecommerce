/**
 * Base URL for API calls.
 *  - In the browser it is empty: requests go to the store's own origin (`/api/v1/...`) and Next.js
 *    proxies them to the API. That keeps cookies first-party and works with a strict CSP
 *    (`connect-src 'self'`) without any CORS setup.
 *  - On the server there is no origin to be relative to, so it calls the API directly.
 */
export function apiBase(): string {
  return typeof window === 'undefined' ? (process.env['API_URL'] ?? 'http://localhost:3001') : '';
}
