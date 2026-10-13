import { z } from 'zod';
import { cepSchema, type OrderStatus } from './base.js';

export const shippingOptionSchema = z.enum(['PICKUP', 'LOCAL', 'SHIPPING']);
export const paymentMethodSchema = z.enum(['PIX', 'CARD']);

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(30),
    customer: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z
        .string()
        .transform((v) => v.replace(/\D/g, ''))
        .refine((v) => v.length === 10 || v.length === 11, 'Telefone inválido'),
      email: z.string().trim().email().max(160),
    }),
    address: z.object({
      cep: cepSchema,
      street: z.string().trim().min(2).max(160),
      number: z.string().trim().min(1).max(20),
      district: z.string().trim().min(1).max(100),
      city: z.string().trim().min(1).max(100),
      state: z
        .string()
        .trim()
        .length(2)
        .transform((v) => v.toUpperCase()),
      complement: z.string().trim().max(100).optional(),
    }),
    shippingOption: shippingOptionSchema,
    paymentMethod: paymentMethodSchema,
    cardToken: z.string().min(1).max(200).optional(),
    cardPaymentMethodId: z.string().min(1).max(50).optional(),
  })
  .refine((o) => o.paymentMethod !== 'CARD' || (!!o.cardToken && !!o.cardPaymentMethodId), {
    message: 'Token do cartão é obrigatório',
    path: ['cardToken'],
  });

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export interface OrderStatusResponse {
  publicCode: string;
  status: OrderStatus;
  items: Array<{ productName: string; quantity: number; unitPriceCents: number }>;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
}

export interface CreateOrderResponse {
  publicCode: string;
  totalCents: number;
  payment: { pixCopyPaste?: string; pixQrCodeBase64?: string };
}
