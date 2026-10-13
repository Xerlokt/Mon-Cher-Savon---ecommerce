import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPaymentUseCase } from '../../application/confirm-payment.use-case.js';
import { CreateOrderUseCase } from '../../application/create-order.use-case.js';
import { GetOrderStatusUseCase } from '../../application/get-order-status.use-case.js';
import { Money } from '../../domain/shared/money.js';
import { DomainError } from '../../domain/shared/domain-error.js';
import { anOrder } from '../../domain/order/testing/order.builder.js';
import { InMemoryOrders } from '../../application/testing/fakes.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';
import { OrdersController } from './orders.controller.js';
import { MP_WEBHOOK_SECRET, WebhooksController } from './webhooks.controller.js';

const SECRET = 'whsec_test';
const validBody = {
  items: [{ productId: '3f1c2b4e-8a1d-4c55-9d0e-1a2b3c4d5e6f', quantity: 2 }],
  customer: { name: 'Maria Souza', phone: '(11) 91234-5678', email: 'maria@example.com' },
  address: {
    cep: '01310-100',
    street: 'Rua das Flores',
    number: '120',
    district: 'Centro',
    city: 'São Paulo',
    state: 'sp',
  },
  shippingOption: 'LOCAL',
  paymentMethod: 'PIX',
};

const createExecute = vi.fn();
const confirmExecute = vi.fn();
const orders = new InMemoryOrders();
let app: INestApplication;

function signedHeaders(dataId: string, ts = Date.now()) {
  const requestId = 'req-1';
  const v1 = createHmac('sha256', SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

beforeAll(async () => {
  await orders.save(
    anOrder()
      .withItem({ unitPrice: Money.cents(1800), quantity: 2 })
      .paid()
      .build(),
  );
  const moduleRef = await Test.createTestingModule({
    controllers: [OrdersController, WebhooksController],
    providers: [
      { provide: CreateOrderUseCase, useValue: { execute: createExecute } },
      { provide: GetOrderStatusUseCase, useValue: new GetOrderStatusUseCase(orders) },
      { provide: ConfirmPaymentUseCase, useValue: { execute: confirmExecute } },
      { provide: MP_WEBHOOK_SECRET, useValue: SECRET },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  createExecute.mockReset();
  confirmExecute.mockReset();
});

describe('POST /orders', () => {
  it('validates the body, normalizes it and returns the payment data', async () => {
    createExecute.mockResolvedValue({
      orderId: 'o1',
      publicCode: 'A7K2',
      totalCents: 4600,
      payment: { providerPaymentId: '9', pixCopyPaste: '000201', pixQrCodeBase64: 'abc' },
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(validBody)
      .expect(201);
    expect(res.body).toEqual({
      publicCode: 'A7K2',
      totalCents: 4600,
      payment: { pixCopyPaste: '000201', pixQrCodeBase64: 'abc' },
    });
    expect(createExecute.mock.calls[0]?.[0]).toMatchObject({
      customer: { phone: '11912345678' },
      address: { state: 'SP' },
    });
  });

  it('rejects invalid bodies with 400 and never calls the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ ...validBody, items: [] })
      .expect(400);
    expect(createExecute).not.toHaveBeenCalled();
  });

  it('maps domain errors to 422', async () => {
    createExecute.mockRejectedValue(new DomainError('Estoque insuficiente para Lavanda'));
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(validBody)
      .expect(422);
    expect(res.body.message).toContain('Estoque');
  });
});

describe('GET /orders/:publicCode', () => {
  it('returns the public status view, case-insensitive', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/orders/a7k2').expect(200);
    expect(res.body).toMatchObject({ publicCode: 'A7K2', status: 'PAID', totalCents: 3600 });
    expect(JSON.stringify(res.body)).not.toContain('maria@example.com');
  });

  it('returns 404 for unknown codes', async () => {
    await request(app.getHttpServer()).get('/api/v1/orders/NOPE').expect(404);
  });
});

describe('POST /webhooks/mercadopago', () => {
  it('rejects requests with an invalid signature', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/mercadopago?data.id=123')
      .set({ 'x-signature': 'ts=1,v1=bad', 'x-request-id': 'req-1' })
      .send({ type: 'payment', data: { id: '123' } })
      .expect(401);
    expect(confirmExecute).not.toHaveBeenCalled();
  });

  it('confirms the payment when the signature is valid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/mercadopago?data.id=123')
      .set(signedHeaders('123'))
      .send({ type: 'payment', data: { id: '123' } })
      .expect(200);
    expect(confirmExecute).toHaveBeenCalledWith('123');
  });

  it('ignores other notification types', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/mercadopago?data.id=555')
      .set(signedHeaders('555'))
      .send({ type: 'merchant_order', data: { id: '555' } })
      .expect(200);
    expect(confirmExecute).not.toHaveBeenCalled();
  });

  it('acknowledges permanent business failures so the provider stops retrying', async () => {
    confirmExecute.mockRejectedValue(new DomainError('Estoque insuficiente'));
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/mercadopago?data.id=777')
      .set(signedHeaders('777'))
      .send({ type: 'payment', data: { id: '777' } })
      .expect(200);
  });

  it('lets unexpected errors surface so the provider retries', async () => {
    confirmExecute.mockRejectedValue(new Error('db down'));
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/mercadopago?data.id=888')
      .set(signedHeaders('888'))
      .send({ type: 'payment', data: { id: '888' } })
      .expect(500);
  });
});
