import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'AWAITING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const cepSchema = z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido');
