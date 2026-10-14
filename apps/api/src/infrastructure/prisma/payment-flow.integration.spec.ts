import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfirmPaymentUseCase } from '../../application/confirm-payment.use-case.js';
import { CreateOrderUseCase } from '../../application/create-order.use-case.js';
import { RefundOrderUseCase } from '../../application/admin-orders.use-cases.js';
import { ExpireOrdersUseCase } from '../../application/expire-orders.use-case.js';
import { FakePaymentGateway } from '../../application/testing/fakes.js';
import { startTestDatabase, type TestDatabase } from '../testing/test-database.js';
import { PrismaOrderRepository } from './prisma-order.repository.js';
import {
  PrismaOrderPayments,
  PrismaOutbox,
  PrismaProcessedPayments,
  PrismaStockMovements,
} from './prisma-payment-stock-outbox.repositories.js';
import { PrismaProductRepository } from './prisma-product.repository.js';
import { TransactionalDb } from './transactional-db.js';

let db: TestDatabase;
let tx: TransactionalDb;
let gateway: FakePaymentGateway;
let products: PrismaProductRepository;
let orders: PrismaOrderRepository;
let createOrder: CreateOrderUseCase;
let confirm: ConfirmPaymentUseCase;
let counter = 0;

const orderInput = (productId: string, quantity: number) => ({
  items: [{ productId, quantity }],
  customer: { name: 'Maria', phone: '11900000000', email: 'm@example.com' },
  address: {
    cep: '01310-100',
    street: 'Rua A',
    number: '1',
    district: 'Centro',
    city: 'SP',
    state: 'SP',
  },
  shippingOption: 'LOCAL' as const,
  paymentMethod: 'PIX' as const,
});

const newProduct = (stock: number) =>
  db.prisma.product.create({
    data: {
      slug: `p-${++counter}`,
      name: `Sabonete ${counter}`,
      priceCents: 1800,
      stock,
      images: [],
    },
  });

beforeAll(async () => {
  db = await startTestDatabase();
  tx = new TransactionalDb(db.prisma);
  gateway = new FakePaymentGateway();
  products = new PrismaProductRepository(tx);
  orders = new PrismaOrderRepository(tx);
  createOrder = new CreateOrderUseCase(
    products,
    orders,
    gateway,
    { PICKUP: 0, LOCAL: 1000, SHIPPING: 2500 },
    () => `C${String(++counter).padStart(3, '0')}`,
  );
  confirm = new ConfirmPaymentUseCase(
    gateway,
    orders,
    products,
    products,
    new PrismaProcessedPayments(tx),
    new PrismaStockMovements(tx),
    new PrismaOutbox(tx),
    tx,
  );
});

afterAll(async () => {
  await db?.stop();
});

describe('payment flow on a real database', () => {
  it('creates an order, confirms payment once and writes stock, movement and outbox', async () => {
    const product = await newProduct(5);
    const { orderId, publicCode, totalCents } = await createOrder.execute(
      orderInput(product.id, 2),
    );
    expect(totalCents).toBe(4600);
    expect((await orders.findByPublicCode(publicCode))?.status).toBe('AWAITING_PAYMENT');

    gateway.approve(`pay-${orderId}`);
    await confirm.execute(`pay-${orderId}`);
    await confirm.execute(`pay-${orderId}`); // duplicate webhook

    expect((await orders.findById(orderId))?.status).toBe('PAID');
    expect((await db.prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(3);
    expect(await db.prisma.stockMovement.count({ where: { orderId } })).toBe(1);
    expect(await db.prisma.payment.count({ where: { orderId } })).toBe(1);
    expect(
      await db.prisma.outboxEvent.count({ where: { type: 'OrderPaid' } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it('refunds a paid order: provider called, status saved, stock and movement restored', async () => {
    const product = await newProduct(5);
    const { orderId } = await createOrder.execute(orderInput(product.id, 2));
    gateway.approve(`pay-${orderId}`);
    await confirm.execute(`pay-${orderId}`);

    const refund = new RefundOrderUseCase(
      orders,
      new PrismaOrderPayments(tx),
      gateway,
      products,
      products,
      new PrismaStockMovements(tx),
      tx,
    );
    await refund.execute(orderId);

    expect(gateway.refunded).toContain(`pay-${orderId}`);
    expect((await orders.findById(orderId))?.status).toBe('REFUNDED');
    expect((await db.prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(5);
    expect(await db.prisma.stockMovement.count({ where: { orderId, reason: 'RESTOCK' } })).toBe(1);
    await expect(refund.execute(orderId)).rejects.toThrow();
  });

  it('never oversells when two payments confirm at the same time', async () => {
    const product = await newProduct(1);
    const a = await createOrder.execute(orderInput(product.id, 1));
    const b = await createOrder.execute(orderInput(product.id, 1));
    gateway.approve(`pay-${a.orderId}`);
    gateway.approve(`pay-${b.orderId}`);

    const results = await Promise.allSettled([
      confirm.execute(`pay-${a.orderId}`),
      confirm.execute(`pay-${b.orderId}`),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await db.prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(0);
    expect(
      await db.prisma.order.count({
        where: { id: { in: [a.orderId, b.orderId] }, status: 'PAID' },
      }),
    ).toBe(1);
  });

  it('rolls back everything when stock is insufficient', async () => {
    const product = await newProduct(1);
    const order = await createOrder.execute(orderInput(product.id, 1));
    await db.prisma.product.update({ where: { id: product.id }, data: { stock: 0 } });
    gateway.approve(`pay-${order.orderId}`);

    await expect(confirm.execute(`pay-${order.orderId}`)).rejects.toThrow(/Estoque/);

    expect((await orders.findById(order.orderId))?.status).toBe('AWAITING_PAYMENT');
    expect(await db.prisma.payment.count({ where: { orderId: order.orderId } })).toBe(0);
  });

  it('expires old unpaid orders only', async () => {
    const product = await newProduct(5);
    const old = await createOrder.execute(orderInput(product.id, 1));
    const fresh = await createOrder.execute(orderInput(product.id, 1));
    await db.prisma.order.update({
      where: { id: old.orderId },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) },
    });

    const cancelled = await new ExpireOrdersUseCase(orders, 30).execute();

    expect(cancelled).toBeGreaterThanOrEqual(1);
    expect((await orders.findById(old.orderId))?.status).toBe('CANCELLED');
    expect((await orders.findById(fresh.orderId))?.status).toBe('AWAITING_PAYMENT');
  });
});
