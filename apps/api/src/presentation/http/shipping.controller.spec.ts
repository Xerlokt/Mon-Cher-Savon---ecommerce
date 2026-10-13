import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_CONFIG, loadConfig } from '../../config.js';
import { ShippingController } from './shipping.controller.js';

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [ShippingController],
    providers: [
      {
        provide: APP_CONFIG,
        useValue: loadConfig({ PAYMENT_MODE: 'fake', SHIPPING_LOCAL_CENTS: '1200' }),
      },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('GET /shipping-options', () => {
  it('lists the configured fixed prices', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/shipping-options').expect(200);
    expect(res.body).toEqual([
      { code: 'PICKUP', label: 'Retirada com a artesã', priceCents: 0 },
      { code: 'LOCAL', label: 'Entrega local', priceCents: 1200 },
      { code: 'SHIPPING', label: 'Envio pelos Correios', priceCents: 2500 },
    ]);
  });
});
