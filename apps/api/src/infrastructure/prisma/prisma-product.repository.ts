import type { Product as Row } from '@prisma/client';
import type { ProductReader, ProductWriter } from '../../domain/ports/index.js';
import { Product } from '../../domain/product/product.js';
import type { DbProvider } from './transactional-db.js';

const toDomain = (row: Row): Product =>
  Product.create({
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceCents: row.priceCents,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    status: row.status,
  });

export class PrismaProductRepository implements ProductReader, ProductWriter {
  constructor(private readonly provider: DbProvider) {}

  async findActive(): Promise<Product[]> {
    const rows = await this.provider.db.product.findMany({ where: { status: 'ACTIVE' } });
    return rows.map(toDomain);
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const row = await this.provider.db.product.findFirst({ where: { slug, status: 'ACTIVE' } });
    return row ? toDomain(row) : null;
  }

  /**
   * Locks the rows (FOR UPDATE) so that, inside a transaction, concurrent payment
   * confirmations serialize and can never sell beyond the available stock.
   */
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    await this.provider.db
      .$queryRaw`SELECT id FROM "Product" WHERE id = ANY(${ids}::text[]) FOR UPDATE`;
    const rows = await this.provider.db.product.findMany({ where: { id: { in: ids } } });
    return rows.map(toDomain);
  }

  /** Updates mutable state of an existing product (stock, status). */
  async save(product: Product): Promise<void> {
    await this.provider.db.product.update({
      where: { id: product.id },
      data: { stock: product.stock, status: product.status },
    });
  }
}
