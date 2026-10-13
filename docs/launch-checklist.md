# Launch checklist (what only a person can do)

The code, tests and configuration are in the repository. These items need accounts, credentials or
the seller herself.

## Accounts and credentials

- [ ] Mercado Pago: production credentials, webhook registered, a real R$ 1 Pix/card payment tested.
- [ ] Telegram bot created with @BotFather; the seller opened it and tapped **Start**.
- [ ] (Optional) WhatsApp Cloud API: verified Meta Business account, template `nova_venda` approved.
- [ ] Vercel, Render and the PostgreSQL provider created; variables set (`docs/deploy.md`).
- [ ] Domain `.com.br` bought and pointed at Vercel; HTTPS working.
- [ ] Sentry project created (optional) and an uptime monitor on `/api/v1/shipping-options`.

## GitHub settings

- [ ] Branch protection on `main`: pull request required, **CI green** required.
- [ ] Secret scanning and push protection enabled; Dependabot alerts on.
- [ ] Private vulnerability reporting enabled (`SECURITY.md` links to it).
- [ ] `DEPLOY_ENABLED` / secrets set only when ready to publish.

## Content and legal

- [ ] The seller reviews `Sobre a artesã`, the product texts and photos (own photos, or free stock).
- [ ] A lawyer reviews the **privacy policy** and **returns policy** (they are well-formed drafts, not
      legal advice); set `NEXT_PUBLIC_CONTACT_EMAIL` to a real address.
- [ ] Confirm the shipping prices in the seller's environment (`SHIPPING_*_CENTS`).

## Usability test with the seller (plan, stage 7)

Timed tasks, no help: (1) register a soap, (2) mark a sale as shipped, (3) find the best seller.
Anything that blocks her becomes an adjustment. Repeat after changes.

## Before pointing customers at it

- [ ] Run `pnpm --filter @mon-cher-savon/e2e test` and `... lighthouse` against the production URLs'
      equivalent stack.
- [ ] Change the seller password, rotate every token used while testing.
- [ ] Place one real order end to end (Pix), confirm the Telegram message arrives, ship it in the panel.
