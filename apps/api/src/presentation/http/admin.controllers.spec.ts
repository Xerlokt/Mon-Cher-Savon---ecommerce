import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ChangeOrderStatusUseCase,
  RefundOrderUseCase,
} from '../../application/admin-orders.use-cases.js';
import {
  AdjustStockUseCase,
  ArchiveProductUseCase,
  CreateIngredientUseCase,
  CreateProductUseCase,
  RestoreProductUseCase,
  UpdateProductUseCase,
} from '../../application/admin-products.use-cases.js';
import {
  FakePaymentGateway,
  InMemoryAdminProducts,
  InMemoryOrderPayments,
  InMemoryOrders,
  InMemoryProducts,
  InMemoryStockMovements,
  InlineUnitOfWork,
} from '../../application/testing/fakes.js';
import { anOrder } from '../../domain/order/testing/order.builder.js';
import { Product } from '../../domain/product/product.js';
import type { AdminOrderQuery } from '../../domain/ports/index.js';
import { AdminAuthController } from './admin-auth.controller.js';
import {
  ADMIN_ORDER_QUERY,
  ADMIN_PRODUCT_REPOSITORY,
  AdminCatalogSupportController,
  AdminOrdersController,
  AdminProductsController,
  IMAGE_STORAGE,
} from './admin-sales-products.controllers.js';
import { ORIGIN, SESSION_COOKIE_HEADER, createAdminTestApp } from './testing/admin-test-app.js';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

let app: INestApplication;
let orders: InMemoryOrders;
let gateway: FakePaymentGateway;
let orderPayments: InMemoryOrderPayments;
let coreProducts: InMemoryProducts;
let adminProducts: InMemoryAdminProducts;
let movements: InMemoryStockMovements;
let saved: Buffer[];

const auth = { Cookie: SESSION_COOKIE_HEADER, Origin: ORIGIN };
const json = { 'Content-Type': 'application/json' };

const orderQuery: AdminOrderQuery = {
  async list(status) {
    const all = [
      {
        id: 'o1',
        publicCode: 'A7K2',
        status: 'PAID' as const,
        customerName: 'Maria',
        totalCents: 3600,
        itemCount: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        paidAt: null,
      },
    ];
    return status ? all.filter((o) => o.status === status) : all;
  },
  async getByPublicCode(code) {
    return code === 'A7K2'
      ? {
          id: 'o1',
          publicCode: 'A7K2',
          status: 'PAID',
          customerName: 'Maria',
          totalCents: 3600,
          itemCount: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
          paidAt: null,
          phone: '11912345678',
          email: 'maria@example.com',
          address: {
            cep: '01310100',
            street: 'Rua A',
            number: '1',
            district: 'Centro',
            city: 'SP',
            state: 'SP',
            complement: null,
          },
          shippingCents: 0,
          items: [{ productName: 'Lavanda', quantity: 2, unitPriceCents: 1800 }],
        }
      : null;
  },
};

beforeEach(async () => {
  await app?.close();
  orders = new InMemoryOrders();
  await orders.save(anOrder().paid().build());
  coreProducts = new InMemoryProducts([
    Product.create({
      id: 'p1',
      slug: 'l',
      name: 'Lavanda',
      priceCents: 1800,
      stock: 2,
      lowStockThreshold: 1,
    }),
  ]);
  adminProducts = new InMemoryAdminProducts();
  movements = new InMemoryStockMovements();
  gateway = new FakePaymentGateway();
  orderPayments = new InMemoryOrderPayments();
  orderPayments.byOrder.set('o1', 'mp-1');
  saved = [];
  app = await createAdminTestApp(
    [
      AdminAuthController,
      AdminOrdersController,
      AdminProductsController,
      AdminCatalogSupportController,
    ],
    [
      { provide: ADMIN_ORDER_QUERY, useValue: orderQuery },
      { provide: ADMIN_PRODUCT_REPOSITORY, useValue: adminProducts },
      {
        provide: ChangeOrderStatusUseCase,
        useValue: new ChangeOrderStatusUseCase(
          orders,
          coreProducts,
          coreProducts,
          movements,
          new InlineUnitOfWork(),
        ),
      },
      {
        provide: RefundOrderUseCase,
        useValue: new RefundOrderUseCase(
          orders,
          orderPayments,
          gateway,
          coreProducts,
          coreProducts,
          movements,
          new InlineUnitOfWork(),
        ),
      },
      {
        provide: CreateProductUseCase,
        useValue: new CreateProductUseCase(adminProducts, movements),
      },
      { provide: UpdateProductUseCase, useValue: new UpdateProductUseCase(adminProducts) },
      { provide: ArchiveProductUseCase, useValue: new ArchiveProductUseCase(adminProducts) },
      { provide: RestoreProductUseCase, useValue: new RestoreProductUseCase(adminProducts) },
      { provide: CreateIngredientUseCase, useValue: new CreateIngredientUseCase(adminProducts) },
      {
        provide: AdjustStockUseCase,
        useValue: new AdjustStockUseCase(
          coreProducts,
          coreProducts,
          movements,
          new InlineUnitOfWork(),
        ),
      },
      {
        provide: IMAGE_STORAGE,
        useValue: {
          async save(data: Buffer) {
            saved.push(data);
            return { url: '/uploads/test.png' };
          },
        },
      },
    ],
  );
});

afterAll(async () => {
  await app?.close();
});

describe('login and session', () => {
  it('sets an httpOnly, SameSite=Lax cookie on login and no Max-Age without remember', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'Ana@Example.com', password: 'segredo-forte' })
      .expect(200);
    const cookie = String(res.headers['set-cookie']?.[0]);
    expect(cookie).toContain('mcs_session=token%3Aa1');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Max-Age');
  });

  it('adds Max-Age when "lembrar de mim" is on', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'ana@example.com', password: 'segredo-forte', remember: true })
      .expect(200);
    expect(String(res.headers['set-cookie']?.[0])).toContain('Max-Age=2592000');
  });

  it('answers 401 for bad credentials and 429 after repeated failures', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({ email: 'ana@example.com', password: 'errada' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('validates the login body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'nope' })
      .expect(400);
  });

  it('logs out by clearing the cookie and reports who is logged in', async () => {
    const out = await request(app.getHttpServer()).post('/api/v1/admin/auth/logout').expect(200);
    expect(String(out.headers['set-cookie']?.[0])).toContain('mcs_session=;');
    const me = await request(app.getHttpServer())
      .get('/api/v1/admin/auth/me')
      .set(auth)
      .expect(200);
    expect(me.body).toEqual({ id: 'a1', email: 'ana@example.com' });
  });
});

describe('admin guard', () => {
  it('rejects requests without a valid session', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/orders').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set({ Cookie: 'mcs_session=forged' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set({ Cookie: 'mcs_session=token:ghost' })
      .expect(401);
  });

  it('blocks state-changing requests from other origins (CSRF)', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/o1/status')
      .set({ Cookie: SESSION_COOKIE_HEADER, Origin: 'https://evil.example' })
      .send({ status: 'SHIPPED' })
      .expect(403);
    expect((await orders.findById('o1'))?.status).toBe('PAID');
  });
});

describe('sales', () => {
  it('lists and shows a sale, uppercasing the code', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/orders?status=PAID')
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(1);
    const detail = await request(app.getHttpServer())
      .get('/api/v1/admin/orders/a7k2')
      .set(auth)
      .expect(200);
    expect(detail.body.phone).toBe('11912345678');
    await request(app.getHttpServer()).get('/api/v1/admin/orders/NOPE').set(auth).expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders?status=LOST')
      .set(auth)
      .expect(400);
  });

  it('marks as shipped with one request and rejects invalid transitions', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/o1/status')
      .set(auth)
      .send({ status: 'SHIPPED' })
      .expect(200);
    expect((await orders.findById('o1'))?.status).toBe('SHIPPED');
    await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/o1/status')
      .set(auth)
      .send({ status: 'CANCELLED' })
      .expect(422);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/o1/status')
      .set(auth)
      .send({ status: 'PAID' })
      .expect(400);
  });
});

describe('refund', () => {
  it('refunds a paid sale at the provider and marks it as refunded', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/orders/o1/refund').set(auth).expect(200);
    expect(gateway.refunded).toEqual(['mp-1']);
    expect((await orders.findById('o1'))?.status).toBe('REFUNDED');
  });

  it('requires a session and a same-origin request', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/orders/o1/refund').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/orders/o1/refund')
      .set({ Cookie: SESSION_COOKIE_HEADER, Origin: 'https://evil.example' })
      .expect(403);
    expect(gateway.refunded).toEqual([]);
  });

  it('answers 404 for an unknown sale and 422 when it was already refunded', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/orders/nope/refund')
      .set(auth)
      .expect(404);
    await request(app.getHttpServer()).post('/api/v1/admin/orders/o1/refund').set(auth).expect(200);
    await request(app.getHttpServer()).post('/api/v1/admin/orders/o1/refund').set(auth).expect(422);
    expect(gateway.refunded).toEqual(['mp-1']);
  });
});

describe('products', () => {
  it('creates, edits, archives and restores', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set(auth)
      .send({ name: 'Sabonete de Mel', priceCents: 1700, stock: 3 })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.slug).toBe('sabonete-de-mel');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${id}`)
      .set(auth)
      .send({ priceCents: 1900 })
      .expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/admin/products/${id}`).set(auth).expect(200);
    expect((await adminProducts.get(id))?.status).toBe('ARCHIVED');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${id}/restore`)
      .set(auth)
      .expect(200);
    expect((await adminProducts.get(id))?.status).toBe('ACTIVE');
    await request(app.getHttpServer()).get(`/api/v1/admin/products/${id}`).set(auth).expect(200);
    await request(app.getHttpServer()).get('/api/v1/admin/products/ghost').set(auth).expect(404);
    const all = await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set(auth)
      .expect(200);
    expect(all.body).toHaveLength(1);
  });

  it('validates input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set(auth)
      .send({ name: 'A', priceCents: 0 })
      .expect(400);
  });

  it('adjusts stock with +/- and records the reason', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/admin/products/p1/stock-adjustments')
      .set(auth)
      .send({ delta: 1, reason: 'RESTOCK' })
      .expect(200);
    expect(up.body.stock).toBe(3);
    await request(app.getHttpServer())
      .post('/api/v1/admin/products/p1/stock-adjustments')
      .set(auth)
      .send({ delta: -9, reason: 'ADJUSTMENT' })
      .expect(422);
    await request(app.getHttpServer())
      .post('/api/v1/admin/products/p1/stock-adjustments')
      .set(auth)
      .send({ delta: 0, reason: 'RESTOCK' })
      .expect(400);
  });
});

describe('ingredients and uploads', () => {
  it('creates an ingredient', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/ingredients')
      .set(auth)
      .set(json)
      .send({ name: 'Aveia', benefit: 'Pele sensível' })
      .expect(201);
    expect(res.body.slug).toBe('aveia');
  });

  it('stores real images and rejects anything else', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .set(auth)
      .attach('file', png, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);
    expect(ok.body.url).toBe('/uploads/test.png');
    expect(saved).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .set(auth)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })
      .expect(422);
    await request(app.getHttpServer()).post('/api/v1/admin/uploads').set(auth).expect(422);
    await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .attach('file', png, { filename: 'foto.png' })
      .expect(401);
    expect(saved).toHaveLength(1);
  });
});
