import { createHmac } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { E2E } from './env.mjs';

export interface MockPayment {
  status: string;
  external_reference?: string;
}

export async function resetMocks(): Promise<void> {
  await fetch(`${E2E.mockUrl}/__control/reset`, { method: 'POST' });
}

export async function telegramMessages(): Promise<Array<{ chat_id: string; text: string }>> {
  const res = await fetch(`${E2E.mockUrl}/__control/telegram`);
  return (await res.json()) as Array<{ chat_id: string; text: string }>;
}

/** Waits until the mocked Telegram has received a message matching `text`. */
export async function waitForTelegram(
  text: string | RegExp,
): Promise<{ chat_id: string; text: string }> {
  let found: { chat_id: string; text: string } | undefined;
  await expect
    .poll(
      async () => {
        found = (await telegramMessages()).find((m) =>
          typeof text === 'string' ? m.text.includes(text) : text.test(m.text),
        );
        return Boolean(found);
      },
      { timeout: 20_000, message: `Telegram did not receive ${String(text)}` },
    )
    .toBe(true);
  return found as { chat_id: string; text: string };
}

/** Plays the part of Mercado Pago: marks the payment approved and sends the signed webhook. */
export async function payAndNotify(): Promise<string> {
  const payments = (await (await fetch(`${E2E.mockUrl}/__control/payments`)).json()) as Record<
    string,
    MockPayment
  >;
  const ids = Object.keys(payments).sort((a, b) => Number(a) - Number(b));
  const id = ids.at(-1);
  if (!id) throw new Error('No payment was created in the mock');

  await fetch(`${E2E.mockUrl}/__control/approve/${id}`, { method: 'POST' });

  const requestId = `e2e-${id}`;
  const ts = Date.now();
  const signature = createHmac('sha256', E2E.webhookSecret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  const res = await fetch(`${E2E.apiUrl}/api/v1/webhooks/mercadopago?data.id=${id}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature': `ts=${ts},v1=${signature}`,
      'x-request-id': requestId,
    },
    body: JSON.stringify({ type: 'payment', data: { id } }),
  });
  expect(res.status, 'signed webhook should be accepted').toBe(200);
  return id;
}

/** Fails with the list of WCAG 2.2 A/AA violations found on the current page. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  // Client-side navigation updates <title> a moment after the content: wait for it, then audit.
  await expect(page, `${label} needs a page title`).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
  expect(summary, `accessibility violations on ${label}`).toEqual([]);
}

/** Interactive elements must be at least 44 px tall (WCAG 2.5.8 / our design rule). */
export async function expectTouchTarget(
  locator: ReturnType<Page['locator']>,
  minimum = 44,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, 'element should be visible').not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minimum);
}

export const VIACEP_BODY = {
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};

export async function mockViaCep(page: Page): Promise<void> {
  await page.route('https://viacep.com.br/ws/*/json/', (route) =>
    route.fulfill({ json: VIACEP_BODY }),
  );
}

/** 1x1 PNG used to test photo upload. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Creates a customer order through the public API and has the "provider" confirm the payment. */
export async function createPaidOrder(customerName = 'Maria Souza'): Promise<string> {
  const products = (await (
    await fetch(`${E2E.apiUrl}/api/v1/products?benefit=seca`)
  ).json()) as Array<{
    id: string;
    name: string;
  }>;
  const product = products.find((p) => p.name === 'Sabonete de Lavanda') ?? products[0];
  if (!product) throw new Error('No product to buy');
  const res = await fetch(`${E2E.apiUrl}/api/v1/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: product.id, quantity: 2 }],
      customer: { name: customerName, phone: '(11) 91234-5678', email: 'maria@example.com' },
      address: {
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '120',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        complement: 'ap. 3',
      },
      shippingOption: 'LOCAL',
      paymentMethod: 'PIX',
    }),
  });
  expect(res.status, 'order should be created').toBe(201);
  const { publicCode } = (await res.json()) as { publicCode: string };
  await payAndNotify();
  return publicCode;
}
