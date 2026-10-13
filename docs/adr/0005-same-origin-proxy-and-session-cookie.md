# ADR 0005 — Same-origin API proxy and signed session cookie

Status: accepted

## Context

The seller panel needs a login. The web app (Next.js) and the API (NestJS) are deployed separately, so a
cookie set by the API would be third-party for the browser, CORS would need credentials, and a strict
Content-Security-Policy (`connect-src 'self'`) would block direct calls. An end-to-end test caught exactly that:
the checkout failed in a production build because the browser called the API origin directly.

## Decision

- The browser only talks to the web origin. Next.js rewrites `/api/v1/*` and `/uploads/*` to the API, so the
  session cookie is first-party, CORS is not needed and the CSP stays `connect-src 'self'` (plus ViaCEP).
- Sessions are a stateless HMAC-signed token (`packages/contracts/src/session.ts`, WebCrypto) in an `httpOnly`,
  `SameSite=Lax` cookie. The same code verifies it in the API guard and in the Next.js middleware, so `/painel`
  is protected before any page renders. "Remember me" sets a 30-day lifetime; otherwise it is a session cookie.
- State-changing admin requests also check the `Origin` header (CSRF defense in depth). Passwords use argon2id;
  login has per-client throttling and lockout.

## Consequences

- No session store to run. Trade-off: a stolen token is valid until it expires (logout only clears the cookie);
  shorten the lifetime or add a server-side revocation list if that becomes a concern.
- `SESSION_SECRET` must be identical in the API and the web app.
- The login throttle is in memory (single API instance).
