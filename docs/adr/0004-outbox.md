# ADR 0004 — Outbox in Postgres for notifications

Status: accepted

## Context

A failing channel must never undo a sale; Redis would add infrastructure.

## Decision

Write an OutboxEvent in the payment transaction; a worker sends with up to 3 retries.

## Consequences

Reliable delivery with only Postgres; at-least-once semantics.
