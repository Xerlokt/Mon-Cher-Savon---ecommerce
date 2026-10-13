# ADR 0002 — Clean Architecture in the API

Status: accepted

## Context

Business rules must not depend on NestJS, Prisma, Mercado Pago or Telegram.

## Decision

Hexagonal layers (domain, application, infrastructure, presentation); infrastructure implements ports defined by the domain.

## Consequences

Rules are unit-tested with in-memory fakes; adapters are swappable.
