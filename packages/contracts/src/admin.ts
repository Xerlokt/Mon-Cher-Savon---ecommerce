import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
  remember: z.boolean().default(false),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const adminOrderStatusFilterSchema = z.enum([
  'AWAITING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

/** Transitions the seller can trigger by hand. Payment confirmation only comes from the provider. */
export const changeOrderStatusSchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']),
});
export type ChangeOrderStatusRequest = z.infer<typeof changeOrderStatusSchema>;

export const productInputSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao sabonete').max(120),
  description: z.string().trim().max(2000).default(''),
  usage: z.string().trim().max(1000).default(''),
  aroma: z.string().trim().max(60).default(''),
  priceCents: z.number().int().min(1, 'Informe o preço').max(1_000_000),
  weightGrams: z.number().int().min(1).max(5000).default(100),
  stock: z.number().int().min(0).max(100_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(1000).default(3),
  images: z.array(z.string().min(1).max(500)).max(8).default([]),
  ingredientIds: z.array(z.string().uuid()).max(30).default([]),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const productUpdateSchema = productInputSchema.omit({ stock: true }).partial();
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export const stockAdjustmentSchema = z.object({
  delta: z
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0, 'A quantidade não pode ser zero'),
  reason: z.enum(['RESTOCK', 'ADJUSTMENT']),
});
export type StockAdjustmentRequest = z.infer<typeof stockAdjustmentSchema>;

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  benefit: z.string().trim().min(2).max(80),
});

export interface AdminProductView {
  id: string;
  slug: string;
  name: string;
  description: string;
  usage: string;
  aroma: string;
  priceCents: number;
  weightGrams: number;
  stock: number;
  lowStockThreshold: number;
  lowStock: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  images: string[];
  ingredientIds: string[];
}

export interface AdminOrderSummary {
  id: string;
  publicCode: string;
  status: z.infer<typeof adminOrderStatusFilterSchema>;
  customerName: string;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  phone: string;
  email: string;
  address: {
    cep: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    complement: string | null;
  };
  shippingCents: number;
  items: Array<{ productName: string; quantity: number; unitPriceCents: number }>;
}

export const dashboardPeriodSchema = z.enum(['hoje', '7dias', 'mes', 'personalizado']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

const MAX_RANGE_DAYS = 366;
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const t = Date.parse(`${v}T00:00:00Z`);
    // Refinements still run after a failed regex, so guard against unparsable input.
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
  }, 'Data inválida');

/** Custom dashboard range: calendar days (YYYY-MM-DD, São Paulo), first <= last, at most a year. */
export const dashboardRangeSchema = z
  .object({ from: isoDay, to: isoDay })
  .refine((r) => r.from <= r.to, { message: 'A data inicial vem antes da final' })
  .refine(
    (r) =>
      (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000 <
      MAX_RANGE_DAYS,
    { message: 'O intervalo pode ter no máximo um ano' },
  );
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export interface DashboardMetrics {
  period: DashboardPeriod;
  /** First and last day (YYYY-MM-DD, São Paulo time) covered by the numbers. */
  from: string;
  to: string;
  revenueCents: number;
  salesCount: number;
  averageTicketCents: number;
  /** One entry per day of the period, including days without sales. */
  salesByDay: Array<{ day: string; salesCount: number; revenueCents: number }>;
  topProducts: Array<{ name: string; quantity: number; revenueCents: number }>;
  topIngredients: Array<{ name: string; quantity: number }>;
  lowStock: Array<{ id: string; name: string; stock: number }>;
}
