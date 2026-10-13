import { z } from 'zod';

const schema = z.object({
  API_PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().default('http://localhost:3001'),
  PAYMENT_MODE: z.enum(['mercadopago', 'fake']).default('mercadopago'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  ORDER_EXPIRATION_MINUTES: z.coerce.number().int().min(5).default(30),
  SHIPPING_PICKUP_CENTS: z.coerce.number().int().min(0).default(0),
  SHIPPING_LOCAL_CENTS: z.coerce.number().int().min(0).default(1000),
  SHIPPING_FLAT_CENTS: z.coerce.number().int().min(0).default(2500),
});

export type AppConfig = z.infer<typeof schema>;
export const APP_CONFIG = 'APP_CONFIG';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = schema.parse(env);
  if (config.PAYMENT_MODE === 'mercadopago') {
    if (!config.MERCADOPAGO_ACCESS_TOKEN || !config.MERCADOPAGO_WEBHOOK_SECRET) {
      throw new Error(
        'Defina MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET (ou PAYMENT_MODE=fake apenas em desenvolvimento).',
      );
    }
  }
  return config;
}
