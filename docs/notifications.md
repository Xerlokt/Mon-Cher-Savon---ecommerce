# Sale notifications

When a payment is confirmed, `ConfirmPayment` writes an `OrderPaid` event to the `OutboxEvent` table in the
same transaction as the order, stock and payment records. A worker (`OutboxWorker`, polling every
`OUTBOX_POLL_MS`) leases due events with `FOR UPDATE SKIP LOCKED`, builds the message and sends it through
every enabled channel. A failing channel never affects the sale: the event is retried with exponential
backoff (30 s, 60 s) and marked `FAILED` after 3 attempts.

## Telegram (recommended first)

1. In Telegram, talk to **@BotFather**, send `/newbot` and copy the token into `TELEGRAM_BOT_TOKEN`.
2. The seller opens the bot and taps **Start**.
3. Get her chat id (for example by messaging **@userinfobot**) and save it in the dashboard settings.
4. Use **Send test message** to confirm.

## WhatsApp (official Cloud API only)

Requires a verified Meta Business account. Business-initiated messages must use an **approved template**
with a single body variable, for example named `nova_venda`:

```text
{{1}}
```

Set `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TEMPLATE_NAME`. The message is sent as one
line (line breaks become `|`) because template variables cannot contain line breaks. Conversations may be
billed by Meta. Do not use libraries that automate WhatsApp Web: they violate the terms of service.

## Admin endpoints (temporary bearer token until stage 5)

- `GET /api/v1/admin/notifications/settings`
- `PUT /api/v1/admin/notifications/settings` — `{ channel, enabled, destination }`
- `POST /api/v1/admin/notifications/test` — `{ channel }`
