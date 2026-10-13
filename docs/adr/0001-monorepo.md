# ADR 0001 — Monorepo (pnpm + Turborepo)

Status: accepted

## Context

Web, API and shared packages evolve together and share types.

## Decision

Single repository with pnpm workspaces and Turborepo build cache.

## Consequences

One toolchain and shared Zod contracts; CI runs only affected tasks.
