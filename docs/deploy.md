# Deploy guide

Nothing here has been run against real accounts: it needs services and credentials only the owner
has. Follow the steps in order; `docs/launch-checklist.md` lists everything that must be done by a
person.

## Pieces

| Piece               | Where                 | Config in this repo                         |
| ------------------- | --------------------- | ------------------------------------------- |
| Web (Next.js)       | Vercel                | `apps/web/vercel.json`                      |
| API + outbox worker | Render (Docker)       | `render.yaml`, `apps/api/Dockerfile`        |
| PostgreSQL          | Neon or Supabase      | `DATABASE_URL`                              |
| Photos              | Cloudinary            | `IMAGE_STORAGE=cloudinary` + `CLOUDINARY_*` |
| Errors/uptime       | Sentry + health check | `GET /api/v1/shipping-options`              |

## Order of work

1. **Database.** Create a PostgreSQL database (Neon/Supabase) and copy its connection string.
2. **API on Render.** Create a Blueprint from `render.yaml` and fill the `sync: false` variables:
   `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -hex 32`), `WEB_ORIGIN` (the store URL),
   `API_PUBLIC_URL` (the API URL), `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` and, when
   used, `TELEGRAM_BOT_TOKEN`. Migrations run before each deploy (`preDeployCommand`).
3. **Web on Vercel.** Import the repository with **Root Directory = `apps/web`**. Set
   `API_URL` (the Render URL) and **the same `SESSION_SECRET`** as the API, plus `SITE_URL`
   and `NEXT_PUBLIC_CONTACT_EMAIL`. Add `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` to turn on card payments
   (empty = Pix only; it also opens the extra CSP origins MercadoPago.js needs, which must be confirmed
   in the sandbox: open the checkout with the browser console and look for blocked requests). Every pull request gets a preview automatically.
4. **Seller account.** From a trusted machine:
   `ADMIN_EMAIL=... ADMIN_PASSWORD=... DATABASE_URL=<production url> pnpm --filter @mon-cher-savon/api db:seed-admin`.
5. **Mercado Pago.** Switch from sandbox to production credentials and register the webhook
   `https://<api-url>/api/v1/webhooks/mercadopago` (event type: payments).
6. **GitHub.** Set the repository variable `DEPLOY_ENABLED=true`, the secrets `DATABASE_URL` and
   `RENDER_DEPLOY_HOOK_URL`, and the variable `API_PUBLIC_URL`; `deploy.yml` then migrates and
   deploys after every green CI run on `main`.

## Public demo (optional)

A separate database + separate API/web deployment with `PAYMENT_MODE=fake` (or Mercado Pago sandbox
credentials). Set `DEMO_ENABLED=true`, the secret `DEMO_DATABASE_URL` and the variable `DEMO_DB_NAME`;
`demo-reset.yml` wipes and reseeds it every day. The script refuses to run unless `DEMO_MODE=true`
and the database name is typed again in `DEMO_CONFIRM_DB_NAME`. The demo seller is
`demo@example.com` / `demo-painel-2026` (public on purpose; fake data only).

## Cost

All providers have a free tier that is enough to start. Variable costs: the Mercado Pago fee per
sale, WhatsApp conversations (if enabled) and the `.com.br` domain. Check current prices first.

## Known limits (honest list)

- **Photos**: in production set `IMAGE_STORAGE=cloudinary` with `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` (the API refuses to start without them). The
  default `local` disk storage is for development and demos only (Render's disk is ephemeral).
  Not yet exercised against the real Cloudinary service, only against simulated HTTP.
- **Login throttle and rate limits** live in memory: correct for one API instance. Scaling out
  needs a shared store.
- **Card payments**: the API supports them, but the checkout screen offers Pix only (card needs the
  MercadoPago.js tokenization with the public key).
- **Refunds**: the panel's "Devolver o dinheiro" gives the full amount back through Mercado Pago (`POST /v1/payments/:id/refunds`, idempotent per payment). Only tested against simulated HTTP so far: try one real refund in sandbox before launch. Partial refunds are still done by hand in Mercado Pago. "Cancelar esta venda" never moves money.
