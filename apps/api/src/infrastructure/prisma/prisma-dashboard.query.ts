import type { PrismaClient } from '@prisma/client';
import type { DashboardQuery, DashboardRaw } from '../../domain/ports/index.js';

/**
 * "paidAt" is a timestamp WITHOUT time zone holding UTC, so it is first tagged as UTC and only then
 * converted to São Paulo time (a single AT TIME ZONE would shift it in the wrong direction).
 * Seller dashboard aggregates computed in PostgreSQL.
 * "Revenue" counts orders confirmed as paid (PAID, SHIPPED, DELIVERED) by their payment date;
 * cancelled orders and orders still waiting for payment never count.
 */
export class PrismaDashboardQuery implements DashboardQuery {
  constructor(private readonly db: PrismaClient) {}

  async aggregate(from: Date, to: Date): Promise<DashboardRaw> {
    const [byDay, topProducts, topIngredients, lowStock] = await Promise.all([
      this.db.$queryRaw<Array<{ day: string; sales: bigint; revenue: bigint }>>`
        SELECT to_char(t.day, 'YYYY-MM-DD') AS day, COUNT(*) AS sales, SUM(t.total) AS revenue
        FROM (
          SELECT o.id,
                 date_trunc('day', (o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') AS day,
                 o."shippingCents" + COALESCE(SUM(i."unitPriceCents" * i.quantity), 0) AS total
          FROM "Order" o
          LEFT JOIN "OrderItem" i ON i."orderId" = o.id
          WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
            AND o."paidAt" >= ${from} AND o."paidAt" < ${to}
          GROUP BY o.id
        ) t
        GROUP BY t.day
        ORDER BY t.day`,
      this.db.$queryRaw<Array<{ name: string; quantity: bigint; revenue: bigint }>>`
        SELECT MIN(i."productName") AS name,
               SUM(i.quantity) AS quantity,
               SUM(i."unitPriceCents" * i.quantity) AS revenue
        FROM "OrderItem" i
        JOIN "Order" o ON o.id = i."orderId"
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
          AND o."paidAt" >= ${from} AND o."paidAt" < ${to}
        GROUP BY i."productId"
        ORDER BY quantity DESC, revenue DESC, name ASC
        LIMIT 5`,
      this.db.$queryRaw<Array<{ name: string; quantity: bigint }>>`
        SELECT g.name AS name, SUM(i.quantity) AS quantity
        FROM "OrderItem" i
        JOIN "Order" o ON o.id = i."orderId"
        JOIN "ProductIngredient" pi ON pi."productId" = i."productId"
        JOIN "Ingredient" g ON g.id = pi."ingredientId"
        WHERE o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
          AND o."paidAt" >= ${from} AND o."paidAt" < ${to}
        GROUP BY g.id, g.name
        ORDER BY quantity DESC, name ASC
        LIMIT 5`,
      this.db.$queryRaw<Array<{ id: string; name: string; stock: number }>>`
        SELECT id, name, stock FROM "Product"
        WHERE status = 'ACTIVE' AND stock <= "lowStockThreshold"
        ORDER BY stock ASC, name ASC
        LIMIT 20`,
    ]);

    return {
      byDay: byDay.map((r) => ({
        day: r.day,
        salesCount: Number(r.sales),
        revenueCents: Number(r.revenue),
      })),
      topProducts: topProducts.map((r) => ({
        name: r.name,
        quantity: Number(r.quantity),
        revenueCents: Number(r.revenue),
      })),
      topIngredients: topIngredients.map((r) => ({ name: r.name, quantity: Number(r.quantity) })),
      lowStock,
    };
  }
}
