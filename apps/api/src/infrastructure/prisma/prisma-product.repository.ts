import type { PrismaClient, Product as Row } from '@prisma/client';
import type { ProductReader, ProductWriter } from '../../domain/ports/index.js';
import { Product } from '../../domain/product/product.js';

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
  constructor(private readonly db: PrismaClient) {}

  async findActive(): Promise<Product[]> {
    const rows = await this.db.product.findMany({ where: { status: 'ACTIVE' } });
    return rows.map(toDomain);
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const row = await this.db.product.findFirst({ where: { slug, status: 'ACTIVE' } });
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const rows = await this.db.product.findMany({ where: { id: { in: ids } } });
    return rows.map(toDomain);
  }

  /** Updates mutable state of an existing product (stock, status). */
  async save(product: Product): Promise<void> {
    await this.db.product.update({
      where: { id: product.id },
      data: { stock: product.stock, status: product.status },
    });
  }
}
