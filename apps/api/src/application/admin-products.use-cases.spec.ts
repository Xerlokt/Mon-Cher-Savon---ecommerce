import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '../domain/shared/domain-error.js';
import { Product } from '../domain/product/product.js';
import {
  AdjustStockUseCase,
  ArchiveProductUseCase,
  CreateIngredientUseCase,
  CreateProductUseCase,
  ProductNotFoundForAdminError,
  RestoreProductUseCase,
  UpdateProductUseCase,
  slugify,
} from './admin-products.use-cases.js';
import {
  InMemoryAdminProducts,
  InMemoryProducts,
  InMemoryStockMovements,
  InlineUnitOfWork,
} from './testing/fakes.js';

const input = (overrides: Record<string, unknown> = {}) => ({
  name: 'Sabonete de Lavanda',
  description: '',
  usage: '',
  aroma: 'Floral',
  priceCents: 1800,
  weightGrams: 100,
  stock: 5,
  lowStockThreshold: 3,
  images: [],
  ingredientIds: [],
  ...overrides,
});

describe('slugify', () => {
  it('removes accents and symbols', () => {
    expect(slugify('Sabonete de Açaí & Mel!')).toBe('sabonete-de-acai-mel');
  });
});

describe('product administration', () => {
  let repo: InMemoryAdminProducts;
  let movements: InMemoryStockMovements;

  beforeEach(() => {
    repo = new InMemoryAdminProducts();
    movements = new InMemoryStockMovements();
  });

  it('creates a product with a unique slug and records the initial stock', async () => {
    const create = new CreateProductUseCase(repo, movements);
    const first = await create.execute(input());
    const second = await create.execute(input());
    expect(first.slug).toBe('sabonete-de-lavanda');
    expect(second.slug).toBe('sabonete-de-lavanda-2');
    expect(movements.movements[0]).toMatchObject({
      productId: first.id,
      delta: 5,
      reason: 'RESTOCK',
    });
  });

  it('does not record a movement when starting with no stock', async () => {
    await new CreateProductUseCase(repo, movements).execute(input({ stock: 0 }));
    expect(movements.movements).toEqual([]);
  });

  it('rejects invalid products using the domain rules', async () => {
    await expect(
      new CreateProductUseCase(repo, movements).execute(input({ name: '   ' })),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('updates content and reports unknown products', async () => {
    const created = await new CreateProductUseCase(repo, movements).execute(input());
    const update = new UpdateProductUseCase(repo);
    const updated = await update.execute(created.id, { priceCents: 2000, name: 'Lavanda Premium' });
    expect(updated).toMatchObject({ priceCents: 2000, name: 'Lavanda Premium' });
    await expect(update.execute('ghost', { name: 'Xx' })).rejects.toBeInstanceOf(
      ProductNotFoundForAdminError,
    );
  });

  it('archives instead of deleting and can restore', async () => {
    const created = await new CreateProductUseCase(repo, movements).execute(input());
    await new ArchiveProductUseCase(repo).execute(created.id);
    expect((await repo.get(created.id))?.status).toBe('ARCHIVED');
    await new RestoreProductUseCase(repo).execute(created.id);
    expect((await repo.get(created.id))?.status).toBe('ACTIVE');
    await expect(new ArchiveProductUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(
      ProductNotFoundForAdminError,
    );
    await expect(new RestoreProductUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(
      ProductNotFoundForAdminError,
    );
  });

  it('creates ingredients with unique slugs', async () => {
    const create = new CreateIngredientUseCase(repo);
    const a = await create.execute({ name: 'Argila Verde', benefit: 'Pele oleosa' });
    const b = await create.execute({ name: 'Argila verde', benefit: 'Pele oleosa' });
    expect(a.slug).toBe('argila-verde');
    expect(b.slug).toBe('argila-verde-2');
  });
});

describe('AdjustStockUseCase', () => {
  let products: InMemoryProducts;
  let movements: InMemoryStockMovements;
  let useCase: AdjustStockUseCase;

  beforeEach(() => {
    movements = new InMemoryStockMovements();
    products = new InMemoryProducts([
      Product.create({
        id: 'p1',
        slug: 'l',
        name: 'Lavanda',
        priceCents: 1800,
        stock: 2,
        lowStockThreshold: 1,
      }),
    ]);
    useCase = new AdjustStockUseCase(products, products, movements, new InlineUnitOfWork());
  });

  it('adds stock and records the reason', async () => {
    expect(await useCase.execute('p1', { delta: 3, reason: 'RESTOCK' })).toBe(5);
    expect(movements.movements).toEqual([{ productId: 'p1', delta: 3, reason: 'RESTOCK' }]);
  });

  it('removes stock but never below zero', async () => {
    expect(await useCase.execute('p1', { delta: -2, reason: 'ADJUSTMENT' })).toBe(0);
    await expect(useCase.execute('p1', { delta: -1, reason: 'ADJUSTMENT' })).rejects.toThrow(
      /Estoque/,
    );
    expect(movements.movements).toHaveLength(1);
  });

  it('fails for unknown products', async () => {
    await expect(useCase.execute('ghost', { delta: 1, reason: 'RESTOCK' })).rejects.toBeInstanceOf(
      ProductNotFoundForAdminError,
    );
  });
});
