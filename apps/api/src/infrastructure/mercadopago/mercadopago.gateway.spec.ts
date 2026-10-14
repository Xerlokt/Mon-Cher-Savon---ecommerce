import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MercadoPagoGateway, PaymentGatewayError } from './mercadopago.gateway.js';

const BASE = 'https://mp.test';
const server = setupServer();
const gateway = new MercadoPagoGateway({
  accessToken: 'TEST-token',
  baseUrl: BASE,
  notificationUrl: 'https://loja.test/api/v1/webhooks/mercadopago',
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MercadoPagoGateway', () => {
  it('creates a Pix payment with idempotency key and returns the QR data', async () => {
    let captured: { headers: Headers; body: Record<string, unknown> } | undefined;
    server.use(
      http.post(`${BASE}/v1/payments`, async ({ request }) => {
        captured = { headers: request.headers, body: (await request.json()) as never };
        return HttpResponse.json({
          id: 987,
          status: 'pending',
          point_of_interaction: {
            transaction_data: { qr_code: '000201abc', qr_code_base64: 'iVBOR' },
          },
        });
      }),
    );

    const result = await gateway.createPayment({
      orderId: 'order-1',
      amountCents: 4600,
      method: 'PIX',
      payerEmail: 'maria@example.com',
    });

    expect(result).toEqual({
      providerPaymentId: '987',
      status: 'PENDING',
      pixCopyPaste: '000201abc',
      pixQrCodeBase64: 'iVBOR',
    });
    expect(captured?.headers.get('authorization')).toBe('Bearer TEST-token');
    expect(captured?.headers.get('x-idempotency-key')).toBe('order-1');
    expect(captured?.body).toMatchObject({
      transaction_amount: 46,
      payment_method_id: 'pix',
      external_reference: 'order-1',
      notification_url: 'https://loja.test/api/v1/webhooks/mercadopago',
    });
    expect(captured?.body['date_of_expiration']).toBeTypeOf('string');
  });

  it('creates a card payment from a token', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/v1/payments`, async ({ request }) => {
        body = (await request.json()) as never;
        return HttpResponse.json({ id: 1, status: 'approved' });
      }),
    );
    const result = await gateway.createPayment({
      orderId: 'o',
      amountCents: 1000,
      method: 'CARD',
      payerEmail: 'a@b.co',
      cardToken: 'tok',
      cardPaymentMethodId: 'visa',
    });
    expect(result.providerPaymentId).toBe('1');
    expect(result.status).toBe('APPROVED');
    expect(body).toMatchObject({ token: 'tok', payment_method_id: 'visa', installments: 1 });
  });

  it('reports a refused card straight away', async () => {
    server.use(
      http.post(`${BASE}/v1/payments`, () =>
        HttpResponse.json({ id: 2, status: 'rejected', status_detail: 'cc_rejected_other_reason' }),
      ),
    );
    const result = await gateway.createPayment({
      orderId: 'o',
      amountCents: 1000,
      method: 'CARD',
      payerEmail: 'a@b.co',
      cardToken: 'tok',
      cardPaymentMethodId: 'visa',
    });
    expect(result.status).toBe('REJECTED');
  });

  it('refuses card payments without token or method', async () => {
    await expect(
      gateway.createPayment({ orderId: 'o', amountCents: 1, method: 'CARD', payerEmail: 'a@b.co' }),
    ).rejects.toBeInstanceOf(PaymentGatewayError);
  });

  it.each([
    ['approved', 'APPROVED'],
    ['pending', 'PENDING'],
    ['in_process', 'PENDING'],
    ['rejected', 'REJECTED'],
    ['cancelled', 'REJECTED'],
  ])('maps provider status %s to %s', async (status, expected) => {
    server.use(
      http.get(`${BASE}/v1/payments/55`, () =>
        HttpResponse.json({ id: 55, status, external_reference: 'order-9' }),
      ),
    );
    expect(await gateway.getPayment('55')).toEqual({ status: expected, orderId: 'order-9' });
  });

  it('refunds the whole payment, with a stable idempotency key', async () => {
    const calls: Array<{ key: string | null; body: unknown; auth: string | null }> = [];
    server.use(
      http.post(`${BASE}/v1/payments/55/refunds`, async ({ request }) => {
        calls.push({
          key: request.headers.get('x-idempotency-key'),
          auth: request.headers.get('authorization'),
          body: await request.json(),
        });
        return HttpResponse.json({ id: 1, status: 'approved' }, { status: 201 });
      }),
    );
    await gateway.refundPayment('55');
    await gateway.refundPayment('55');
    // An empty body means "refund everything"; the same key makes a retry the same refund.
    expect(calls[0]).toEqual({ key: 'refund-55', auth: 'Bearer TEST-token', body: {} });
    expect(calls[1]?.key).toBe('refund-55');
  });

  it('turns a refused refund into a gateway error', async () => {
    server.use(
      http.post(`${BASE}/v1/payments/55/refunds`, () => new HttpResponse(null, { status: 400 })),
    );
    await expect(gateway.refundPayment('55')).rejects.toMatchObject({ status: 400 });
  });

  it('throws a gateway error on provider failure', async () => {
    server.use(http.get(`${BASE}/v1/payments/1`, () => new HttpResponse(null, { status: 500 })));
    await expect(gateway.getPayment('1')).rejects.toMatchObject({ status: 500 });
  });
});
