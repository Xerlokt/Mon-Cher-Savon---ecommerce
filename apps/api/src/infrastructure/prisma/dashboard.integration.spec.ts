import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetDashboardUseCase } from '../../application/dashboard.use-case.js';
import { startTestDatabase, type TestDatabase } from '../testing/test-database.js';
import { PrismaDashboardQuery } from './prisma-dashboard.query.js';

let db: TestDatabase;
// 2026-03-18 14:00 in São Paulo
const now = new Date('2026-03-18T17:00:00Z');

const address = {
  customerName: 'Maria',
  phone: '11912345678',
  email: 'm@example.com',
  cep: '01310100',
  street: 'Rua A',
  number: '1',
  district: 'Centro',
  city: 'SP',
  state: 'SP',
};

let counter = 0;
async function order(
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'AWAITING_PAYMENT',
  paidAt: string | null,
  items: Array<{ productId: string; name: string; price: number; quantity: number }>,
  shippingCents = 1000,
) {
  await db.prisma.order.create({
    data: {
      ...address,
      publicCode: `D${String(++counter).padStart(4, '0')}`,
      status,
      paidAt: paidAt ? new Date(paidAt) : null,
      shippingCents,
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          productName: i.name,
          unitPriceCents: i.price,
          quantity: i.quantity,
        })),
      },
    },
  });
}

beforeAll(async () => {
  db = await startTestDatabase();
  const karite = await db.prisma.ingredient.create({
    data: { slug: 'karite', name: 'Karité', benefit: 'Pele seca' },
  });
  const argila = await db.prisma.ingredient.create({
    data: { slug: 'argila', name: 'Argila', benefit: 'Pele oleosa' },
  });
  const lavanda = await db.prisma.product.create({
    data: {
      slug: 'lavanda',
      name: 'Lavanda',
      priceCents: 1800,
      stock: 10,
      images: [],
      ingredients: { create: [{ ingredientId: karite.id }] },
    },
  });
  const verde = await db.prisma.product.create({
    data: {
      slug: 'verde',
      name: 'Argila Verde',
      priceCents: 2200,
      stock: 2,
      lowStockThreshold: 3,
      images: [],
      ingredients: { create: [{ ingredientId: argila.id }, { ingredientId: karite.id }] },
    },
  });
  await db.prisma.product.create({
    data: {
      slug: 'velho',
      name: 'Velho',
      priceCents: 100,
      stock: 0,
      status: 'ARCHIVED',
      images: [],
    },
  });

  const L = { productId: lavanda.id, name: 'Lavanda', price: 1800 };
  const V = { productId: verde.id, name: 'Argila Verde', price: 2200 };

  // Today (18th): two paid sales -> 2*1800+1000 = 4600 and 2200+1000 = 3200
  await order('PAID', '2026-03-18T15:00:00Z', [{ ...L, quantity: 2 }]);
  await order('SHIPPED', '2026-03-18T13:00:00Z', [{ ...V, quantity: 1 }]);
  // 16th: one delivered sale -> 1800 + 1000
  await order('DELIVERED', '2026-03-16T12:00:00Z', [{ ...L, quantity: 1 }]);
  // Late night on the 17th in São Paulo is already the 18th in UTC: must count on the 17th
  await order('PAID', '2026-03-18T01:30:00Z', [{ ...V, quantity: 2 }], 0);
  // Never counted
  await order('CANCELLED', '2026-03-18T15:00:00Z', [{ ...L, quantity: 9 }]);
  await order('AWAITING_PAYMENT', null, [{ ...L, quantity: 9 }]);
  // Before the 7-day window
  await order('PAID', '2026-03-05T12:00:00Z', [{ ...L, quantity: 4 }]);
});

afterAll(async () => {
  await db?.stop();
});

const dashboard = () => new GetDashboardUseCase(new PrismaDashboardQuery(db.prisma), () => now);

describe('dashboard on a real database', () => {
  it('"hoje" counts only today and only confirmed sales', async () => {
    const d = await dashboard().execute('hoje');
    expect(d).toMatchObject({ salesCount: 2, revenueCents: 4600 + 3200, averageTicketCents: 3900 });
  });

  it('"7dias" groups by São Paulo day and fills the gaps', async () => {
    const d = await dashboard().execute('7dias');
    const byDay = Object.fromEntries(d.salesByDay.map((x) => [x.day, x]));
    expect(d.salesByDay).toHaveLength(7);
    expect(byDay['2026-03-17']).toMatchObject({ salesCount: 1, revenueCents: 4400 });
    expect(byDay['2026-03-18']).toMatchObject({ salesCount: 2, revenueCents: 7800 });
    expect(byDay['2026-03-16']).toMatchObject({ salesCount: 1, revenueCents: 2800 });
    expect(byDay['2026-03-15']).toMatchObject({ salesCount: 0, revenueCents: 0 });
    expect(d.salesCount).toBe(4);
    expect(d.revenueCents).toBe(4400 + 7800 + 2800);
  });

  it('"mes" includes the earlier sale from the 5th', async () => {
    const d = await dashboard().execute('mes');
    expect(d.salesCount).toBe(5);
    expect(d.salesByDay).toHaveLength(18);
  });

  it('ranks top products by units sold and ignores cancelled orders', async () => {
    const d = await dashboard().execute('7dias');
    expect(d.topProducts).toEqual([
      { name: 'Argila Verde', quantity: 3, revenueCents: 6600 },
      { name: 'Lavanda', quantity: 3, revenueCents: 5400 },
    ]);
  });

  it('ranks ingredients by units bought through their products', async () => {
    const d = await dashboard().execute('7dias');
    // Karité: Lavanda 3 + Argila Verde 3 = 6; Argila: 3
    expect(d.topIngredients).toEqual([
      { name: 'Karité', quantity: 6 },
      { name: 'Argila', quantity: 3 },
    ]);
  });

  it('lists active products at or below their low-stock threshold', async () => {
    const d = await dashboard().execute('hoje');
    expect(d.lowStock).toEqual([expect.objectContaining({ name: 'Argila Verde', stock: 2 })]);
  });
});
