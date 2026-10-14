import { describe, expect, it } from 'vitest';
import {
  changeOrderStatusSchema,
  loginSchema,
  productInputSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from './admin.js';

describe('admin contracts', () => {
  it('normalizes the login email and defaults remember to false', () => {
    expect(loginSchema.parse({ email: '  Ana@Example.COM ', password: 'x' })).toEqual({
      email: 'ana@example.com',
      password: 'x',
      remember: false,
    });
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('only allows manual transitions the seller can make', () => {
    expect(changeOrderStatusSchema.safeParse({ status: 'SHIPPED' }).success).toBe(true);
    expect(changeOrderStatusSchema.safeParse({ status: 'PAID' }).success).toBe(false);
  });

  it('validates a product and applies defaults', () => {
    const product = productInputSchema.parse({ name: ' Lavanda ', priceCents: 1800 });
    expect(product).toMatchObject({ name: 'Lavanda', weightGrams: 100, stock: 0, images: [] });
    expect(productInputSchema.safeParse({ name: 'A', priceCents: 1800 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: 'Lavanda', priceCents: 0 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: 'Lavanda', priceCents: 10.5 }).success).toBe(false);
  });

  it('does not let updates change the stock directly', () => {
    const update = productUpdateSchema.parse({ name: 'Novo nome', stock: 999 });
    expect(update).toEqual({ name: 'Novo nome' });
  });

  it('rejects empty or absurd stock adjustments', () => {
    expect(stockAdjustmentSchema.safeParse({ delta: 0, reason: 'RESTOCK' }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ delta: 5000, reason: 'RESTOCK' }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ delta: -2, reason: 'SALE' }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ delta: -2, reason: 'ADJUSTMENT' }).success).toBe(true);
  });
});

describe('dashboard period', () => {
  it('accepts only the presets and the custom range', async () => {
    const { dashboardPeriodSchema } = await import('./admin.js');
    expect(dashboardPeriodSchema.safeParse('7dias').success).toBe(true);
    expect(dashboardPeriodSchema.safeParse('personalizado').success).toBe(true);
    expect(dashboardPeriodSchema.safeParse('ano').success).toBe(false);
  });

  it('validates a custom date range', async () => {
    const { dashboardRangeSchema } = await import('./admin.js');
    const ok = (from: string, to: string) => dashboardRangeSchema.safeParse({ from, to }).success;
    expect(ok('2026-03-01', '2026-03-18')).toBe(true);
    expect(ok('2026-03-01', '2026-03-01')).toBe(true);
    // order, impossible dates, wrong format and the one-year limit
    expect(ok('2026-03-18', '2026-03-01')).toBe(false);
    expect(ok('2026-02-30', '2026-03-01')).toBe(false);
    expect(ok('18/03/2026', '2026-03-20')).toBe(false);
    expect(ok('2024-01-01', '2026-03-01')).toBe(false);
  });
});
