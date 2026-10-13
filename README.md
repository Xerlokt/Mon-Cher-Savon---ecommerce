# Mon Cher Savon

Artisanal soap e-commerce: a mobile-first storefront and a simple seller dashboard that notifies each sale on Telegram/WhatsApp. TypeScript monorepo (Next.js, NestJS, Prisma/PostgreSQL), Clean Architecture, TDD.

## Quick start

```bash
pnpm install
docker compose up -d
pnpm dev
pnpm test        # unit tests; pnpm test:cov enforces >= 90% on domain + application
```

Copy `.env.example` to `.env`. Never commit secrets (gitleaks runs in pre-commit and CI).

## Structure

- `apps/api` — NestJS API (domain / application / infrastructure / presentation)
- `apps/web` — Next.js storefront + `/painel`
- `packages/contracts` — shared Zod schemas · `packages/ui-tokens` — botanical design tokens
- `docs/adr` — architecture decisions

## Português

Loja online de sabonetes artesanais **Mon Cher Savon**: vitrine para clientes e painel simples para a vendedora, com aviso de venda no Telegram/WhatsApp. Veja o plano completo e as decisões em `docs/adr`.

License: MIT.
