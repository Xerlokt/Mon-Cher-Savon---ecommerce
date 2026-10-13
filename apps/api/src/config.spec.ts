import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('requires Mercado Pago credentials by default', () => {
    expect(() => loadConfig({})).toThrow(/MERCADOPAGO_ACCESS_TOKEN/);
  });

  it('allows fake payments explicitly and applies defaults', () => {
    const config = loadConfig({ PAYMENT_MODE: 'fake' });
    expect(config.API_PORT).toBe(3001);
    expect(config.SHIPPING_LOCAL_CENTS).toBe(1000);
    expect(config.ORDER_EXPIRATION_MINUTES).toBe(30);
  });

  it('accepts real credentials', () => {
    const config = loadConfig({
      MERCADOPAGO_ACCESS_TOKEN: 'TEST-1',
      MERCADOPAGO_WEBHOOK_SECRET: 's',
      ORDER_EXPIRATION_MINUTES: '45',
    });
    expect(config.ORDER_EXPIRATION_MINUTES).toBe(45);
  });
});
