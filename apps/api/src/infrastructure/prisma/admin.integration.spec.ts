import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AdjustStockUseCase,
  ArchiveProductUseCase,
  CreateIngredientUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
} from '../../application/admin-products.use-cases.js';
import { ChangeOrderStatusUseCase } from '../../application/admin-orders.use-cases.js';
import { startTestDatabase, type TestDatabase } from '../testing/test-database.js';
import { Argon2idHasher } from '../security/security.js';
import {
  PrismaAdminOrderQuery,
  PrismaAdminProductRepository,
  PrismaAdminUsers,
} from './prisma-admin.repositories.js';
import { PrismaOrderRepository } from './prisma-order.repository.js';
import { PrismaStockMovements } from './prisma-payment-stock-outbox.repositories.js';
import { PrismaProductRepository } from './prisma-product.repository.js';
import { TransactionalDb } from './transactional-db.js';

let db: TestDatabase;
let repo: PrismaAdminProductRepository;
let tx: TransactionalDb;

beforeAll(async () => {
  db = await startTestDatabase();
  repo = new PrismaAdminProductRepository(db.prisma);
  tx = new TransactionalDb(db.prisma);
});

afterAll(async () => {
  await db?.stop();
});

const input = (name = 'Sabonete de Lavanda', ingredientIds: string[] = []) => ({
  name,
  description: 'Feito à mão',
  usage: 'Use no banho',
  aroma: 'Floral',
  priceCents: 1800,
  weightGrams: 100,
  stock: 4,
  lowStockThreshold: 3,
  images: ['/uploads/a.png'],
  ingredientIds,
});

describe('admin products on a real database', () => {
  it('creates, edits, adjusts stock and archives with history preserved', async () => {
    const movements = new PrismaStockMovements(tx);
    const ingredient = await new CreateIngredientUseCase(repo).execute({
      name: 'Manteiga de Karité',
      benefit: 'Pele seca',
    });
    const created = await new CreateProductUseCase(repo, movements).execute(
      input('Sabonete de Lavanda', [ingredient.id]),
    );
    expect(created).toMatchObject({ slug: 'sabonete-de-lavanda', stock: 4, lowStock: false });
    expect(created.ingredientIds).toEqual([ingredient.id]);
    const twin = await new CreateProductUseCase(repo, movements).execute(input());
    expect(twin.slug).toBe('sabonete-de-lavanda-2');

    const updated = await new UpdateProductUseCase(repo).execute(created.id, {
      priceCents: 2000,
      ingredientIds: [],
    });
    expect(updated).toMatchObject({ priceCents: 2000, ingredientIds: [] });

    const products = new PrismaProductRepository(tx);
    const adjust = new AdjustStockUseCase(products, products, movements, tx);
    expect(await adjust.execute(created.id, { delta: -2, reason: 'ADJUSTMENT' })).toBe(2);
    expect((await repo.get(created.id))?.lowStock).toBe(true);
    await expect(adjust.execute(created.id, { delta: -5, reason: 'ADJUSTMENT' })).rejects.toThrow(
      /Estoque/,
    );
    expect(await db.prisma.stockMovement.count({ where: { productId: created.id } })).toBe(2);

    await new ArchiveProductUseCase(repo).execute(created.id);
    expect(await db.prisma.product.count({ where: { id: created.id } })).toBe(1);
    expect((await repo.list()).find((p) => p.id === created.id)?.status).toBe('ARCHIVED');
    expect(await new PrismaProductRepository(tx).findBySlug('sabonete-de-lavanda')).toBeNull();
  });
});

describe('admin orders on a real database', () => {
  it('lists by status, hides nothing from the seller and handles cancellation with restock', async () => {
    const movements = new PrismaStockMovements(tx);
    const product = await new CreateProductUseCase(repo, movements).execute(input('Argila', []));
    const order = await db.prisma.order.create({
      data: {
        publicCode: 'ADM001',
        status: 'PAID',
        paidAt: new Date(),
        customerName: 'Maria Souza',
        phone: '11912345678',
        email: 'maria@example.com',
        cep: '01310100',
        street: 'Rua A',
        number: '1',
        district: 'Centro',
        city: 'SP',
        state: 'SP',
        shippingCents: 1000,
        items: {
          create: [
            { productId: product.id, productName: 'Argila', unitPriceCents: 1800, quantity: 2 },
          ],
        },
      },
    });
    const query = new PrismaAdminOrderQuery(db.prisma);

    expect((await query.list('PAID')).map((o) => o.publicCode)).toContain('ADM001');
    expect((await query.list('SHIPPED')).map((o) => o.publicCode)).not.toContain('ADM001');
    const detail = await query.getByPublicCode('ADM001');
    expect(detail).toMatchObject({ totalCents: 4600, itemCount: 2, phone: '11912345678' });
    expect(await query.getByPublicCode('NOPE')).toBeNull();

    const products = new PrismaProductRepository(tx);
    const change = new ChangeOrderStatusUseCase(
      new PrismaOrderRepository(tx),
      products,
      products,
      movements,
      tx,
    );
    await change.execute(order.id, 'CANCELLED');
    expect((await db.prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe(
      'CANCELLED',
    );
    expect((await repo.get(product.id))?.stock).toBe(6);
  });
});

describe('admin users', () => {
  it('finds an admin by email and verifies the argon2id hash', async () => {
    const hasher = new Argon2idHasher();
    await db.prisma.adminUser.create({
      data: { email: 'ana@example.com', passwordHash: await hasher.hash('senha-bem-forte') },
    });
    const admin = await new PrismaAdminUsers(db.prisma).findByEmail('ana@example.com');
    expect(admin).not.toBeNull();
    expect(await hasher.verify(admin?.passwordHash ?? '', 'senha-bem-forte')).toBe(true);
    expect(await new PrismaAdminUsers(db.prisma).findById(admin?.id ?? '')).not.toBeNull();
    expect(await new PrismaAdminUsers(db.prisma).findByEmail('x@example.com')).toBeNull();
  });
});
