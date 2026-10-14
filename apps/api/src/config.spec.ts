import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const SESSION_SECRET = 'x'.repeat(40);

describe('loadConfig', () => {
  it('rejects a short session secret', () => {
    expect(() => loadConfig({ PAYMENT_MODE: 'fake', SESSION_SECRET: 'short' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('requires Mercado Pago credentials by default', () => {
    expect(() => loadConfig({ SESSION_SECRET })).toThrow(/MERCADOPAGO_ACCESS_TOKEN/);
  });

  it('allows fake payments explicitly and applies defaults', () => {
    const config = loadConfig({ PAYMENT_MODE: 'fake', SESSION_SECRET });
    expect(config.API_PORT).toBe(3001);
    expect(config.SHIPPING_LOCAL_CENTS).toBe(1000);
    expect(config.ORDER_EXPIRATION_MINUTES).toBe(30);
  });

  it('requires Cloudinary credentials when cloudinary storage is selected', () => {
    const base = { PAYMENT_MODE: 'fake', SESSION_SECRET, IMAGE_STORAGE: 'cloudinary' };
    expect(() => loadConfig(base)).toThrow(/CLOUDINARY_CLOUD_NAME/);
    const config = loadConfig({
      ...base,
      CLOUDINARY_CLOUD_NAME: 'c',
      CLOUDINARY_API_KEY: 'k',
      CLOUDINARY_API_SECRET: 's',
    });
    expect(config.CLOUDINARY_FOLDER).toBe('mon-cher-savon');
  });

  it('accepts real credentials', () => {
    const config = loadConfig({
      SESSION_SECRET,
      MERCADOPAGO_ACCESS_TOKEN: 'TEST-1',
      MERCADOPAGO_WEBHOOK_SECRET: 's',
      ORDER_EXPIRATION_MINUTES: '45',
    });
    expect(config.ORDER_EXPIRATION_MINUTES).toBe(45);
  });
});
