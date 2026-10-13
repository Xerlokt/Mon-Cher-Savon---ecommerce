import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfirmPaymentUseCase } from '../../application/confirm-payment.use-case.js';
import { CreateOrderUseCase } from '../../application/create-order.use-case.js';
import { NotifySaleUseCase } from '../../application/notify-sale.use-case.js';
import { ProcessOutboxUseCase } from '../../application/process-outbox.use-case.js';
import { FakeChannel, FakePaymentGateway } from '../../application/testing/fakes.js';
import { startTestDatabase, type TestDatabase } from '../testing/test-database.js';
import { PrismaOrderRepository } from './prisma-order.repository.js';
import {
  PrismaNotificationLog,
  PrismaNotificationSettings,
  PrismaOutboxQueue,
} from './prisma-notification.repositories.js';
import {
  PrismaOutbox,
  PrismaProcessedPayments,
  PrismaStockMovements,
} from './prisma-payment-stock-outbox.repositories.js';
import { PrismaProductRepository } from './prisma-product.repository.js';
import { TransactionalDb } from './transactional-db.js';

let db: TestDatabase;
let gateway: FakePaymentGateway;
let confirm: ConfirmPaymentUseCase;
let createOrder: CreateOrderUseCase;
let queue: PrismaOutboxQueue;
let counter = 0;

const input = (productId: string) => ({
  items: [{ productId, quantity: 1 }],
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

async function paidOrder(): Promise<string> {
  const product = await db.prisma.product.create({
    data: { slug: `s-${++counter}`, name: 'Sabonete', priceCents: 1800, stock: 5, images: [] },
  });
  const { orderId } = await createOrder.execute(input(product.id));
  gateway.approve(`pay-${orderId}`);
  await confirm.execute(`pay-${orderId}`);
  return orderId;
}

beforeAll(async () => {
  db = await startTestDatabase();
  const tx = new TransactionalDb(db.prisma);
  gateway = new FakePaymentGateway();
  const products = new PrismaProductRepository(tx);
  const orders = new PrismaOrderRepository(tx);
  createOrder = new CreateOrderUseCase(
    products,
    orders,
    gateway,
    { PICKUP: 0, LOCAL: 1000, SHIPPING: 2500 },
    () => `N${String(++counter).padStart(3, '0')}`,
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
  queue = new PrismaOutboxQueue(db.prisma);
});

afterAll(async () => {
  await db?.stop();
});

const worker = (channel: FakeChannel, maxAttempts = 3, now = () => new Date()) => {
  const tx = new TransactionalDb(db.prisma);
  const notify = new NotifySaleUseCase(
    [channel],
    new PrismaNotificationSettings(db.prisma),
    new PrismaNotificationLog(db.prisma),
    'https://loja.test',
  );
  return new ProcessOutboxUseCase(
    queue,
    new PrismaOrderRepository(tx),
    notify,
    { maxAttempts, backoffMs: () => 0 },
    now,
  );
};

describe('sale notification through the outbox', () => {
  it('delivers a paid order to the enabled channel exactly once and logs it', async () => {
    await new PrismaNotificationSettings(db.prisma).save({
      channel: 'telegram',
      enabled: true,
      destination: '123456',
    });
    const orderId = await paidOrder();
    const telegram = new FakeChannel('telegram');

    const first = await worker(telegram).execute();
    const second = await worker(telegram).execute();

    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(second.sent).toBe(0);
    expect(telegram.sent).toHaveLength(first.sent);
    expect(telegram.sent[0]?.destination).toBe('123456');
    expect(telegram.sent.some((m) => m.text.includes('Nova venda!'))).toBe(true);
    expect(await db.prisma.notificationLog.count({ where: { orderId, success: true } })).toBe(1);
  });

  it('retries after a channel failure and the sale stays paid', async () => {
    const orderId = await paidOrder();
    const flaky = new FakeChannel('telegram', true);

    const failing = await worker(flaky).execute();
    expect(failing.retried).toBeGreaterThanOrEqual(1);
    expect((await db.prisma.order.findUnique({ where: { id: orderId } }))?.status).toBe('PAID');
    expect(
      await db.prisma.outboxEvent.count({ where: { status: 'PENDING', attempts: 1 } }),
    ).toBeGreaterThanOrEqual(1);

    const healthy = new FakeChannel('telegram');
    const recovered = await worker(healthy).execute();
    expect(recovered.sent).toBeGreaterThanOrEqual(1);
  });

  it('gives up after the maximum attempts', async () => {
    await paidOrder();
    const dead = new FakeChannel('telegram', true);
    let last = { sent: 0, retried: 0, failed: 0 };
    for (let i = 0; i < 4; i++) last = await worker(dead, 3).execute();
    expect(
      await db.prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
    ).toBeGreaterThanOrEqual(1);
    expect(last.sent).toBe(0);
  });

  it('never hands the same event to two concurrent workers', async () => {
    await db.prisma.outboxEvent.deleteMany();
    for (let i = 0; i < 6; i++) {
      await db.prisma.outboxEvent.create({
        data: { type: 'OrderPaid', payload: { orderId: `x${i}` } },
      });
    }
    const now = new Date();
    const claims = await Promise.all(
      Array.from({ length: 4 }, () => queue.claimDue(3, now, 60_000)),
    );
    const ids = claims.flat().map((e) => e.id);
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
