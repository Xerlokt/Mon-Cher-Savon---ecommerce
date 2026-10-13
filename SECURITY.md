# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository and include the
steps to reproduce. We aim to acknowledge reports within 72 hours.

## What is (and is not) in this repository

- No secrets and no real customer data. Configuration lives in `.env.example` (names only); real
  values exist only in the hosting providers. Seeds and screenshots use fake data.
- `gitleaks` runs on every commit and pull request. If a key ever leaks, **revoke it immediately**:
  deleting the commit is not enough because the history is public.
- Payments are confirmed only after the API asks Mercado Pago for the payment status; webhooks are
  signature-checked and idempotent. Card data never reaches this system.

## Supported versions

Only the `main` branch is supported.
