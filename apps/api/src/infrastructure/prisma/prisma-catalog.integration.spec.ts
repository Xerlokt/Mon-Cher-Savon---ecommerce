import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../testing/test-database.js';
import { PrismaCatalogQuery } from './prisma-catalog.query.js';
import { PrismaProductRepository } from './prisma-product.repository.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase();
  const argila = await db.prisma.ingredient.create({
    data: { slug: 'argila-verde', name: 'Argila verde', benefit: 'Pele oleosa' },
  });
  const manteiga = await db.prisma.ingredient.create({
    data: { slug: 'manteiga-karite', name: 'Manteiga de karité', benefit: 'Pele seca' },
  });
  await db.prisma.product.create({
    data: {
      slug: 'lavanda',
      name: 'Sabonete de Lavanda',
      priceCents: 1800,
      stock: 5,
      aroma: 'Floral',
      images: ['https://img.test/lavanda.jpg'],
      ingredients: { create: [{ ingredientId: manteiga.id }] },
    },
  });
  await db.prisma.product.create({
    data: {
      slug: 'argila',
      name: 'Sabonete de Argila Verde',
      priceCents: 2200,
      stock: 0,
      aroma: 'Herbal',
      images: [],
      ingredients: { create: [{ ingredientId: argila.id }] },
    },
  });
  await db.prisma.product.create({
    data: {
      slug: 'antigo',
      name: 'Antigo',
      priceCents: 100,
      stock: 1,
      status: 'ARCHIVED',
      images: [],
    },
  });
});

afterAll(async () => {
  await db?.stop();
});

describe('PrismaCatalogQuery', () => {
  it('lists only active products with sold-out flag', async () => {
    const list = await new PrismaCatalogQuery(db.prisma).listProducts({});
    expect(list.map((p) => p.slug)).toEqual(['argila', 'lavanda']);
    expect(list.find((p) => p.slug === 'argila')?.soldOut).toBe(true);
    expect(list.find((p) => p.slug === 'lavanda')?.imageUrl).toBe('https://img.test/lavanda.jpg');
  });

  it('filters by ingredient, aroma and benefit', async () => {
    const q = new PrismaCatalogQuery(db.prisma);
    expect((await q.listProducts({ ingredient: 'argila-verde' })).map((p) => p.slug)).toEqual([
      'argila',
    ]);
    expect((await q.listProducts({ aroma: 'floral' })).map((p) => p.slug)).toEqual(['lavanda']);
    expect((await q.listProducts({ benefit: 'seca' })).map((p) => p.slug)).toEqual(['lavanda']);
  });

  it('returns detail with ingredients and hides archived products', async () => {
    const q = new PrismaCatalogQuery(db.prisma);
    const detail = await q.getProductBySlug('lavanda');
    expect(detail?.ingredients.map((i) => i.slug)).toEqual(['manteiga-karite']);
    expect(await q.getProductBySlug('antigo')).toBeNull();
  });

  it('lists ingredients by name', async () => {
    expect((await new PrismaCatalogQuery(db.prisma).listIngredients()).map((i) => i.slug)).toEqual([
      'argila-verde',
      'manteiga-karite',
    ]);
  });
});

describe('PrismaProductRepository', () => {
  it('maps rows to domain products and persists stock changes', async () => {
    const repo = new PrismaProductRepository(db.prisma);
    const product = await repo.findBySlug('lavanda');
    expect(product?.stock).toBe(5);
    product?.decreaseStock(2);
    if (product) await repo.save(product);
    expect((await repo.findBySlug('lavanda'))?.stock).toBe(3);
    expect((await repo.findActive()).length).toBe(2);
    expect(await repo.findByIds([product?.id ?? ''])).toHaveLength(1);
  });
});
