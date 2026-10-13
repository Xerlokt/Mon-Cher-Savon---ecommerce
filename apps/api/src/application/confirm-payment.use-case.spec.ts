import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../domain/shared/money.js';
import { Product } from '../domain/product/product.js';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case.js';
import {
  FakePaymentGateway,
  InMemoryOrders,
  InMemoryOutbox,
  InMemoryProcessedPayments,
  InMemoryProducts,
  InMemoryStockMovements,
  InlineUnitOfWork,
} from './testing/fakes.js';

describe('ConfirmPaymentUseCase', () => {
  let gateway: FakePaymentGateway;
  let orders: InMemoryOrders;
  let products: InMemoryProducts;
  let outbox: InMemoryOutbox;
  let movements: InMemoryStockMovements;
  let useCase: ConfirmPaymentUseCase;

  beforeEach(async () => {
    gateway = new FakePaymentGateway();
    orders = new InMemoryOrders();
    outbox = new InMemoryOutbox();
    movements = new InMemoryStockMovements();
    products = new InMemoryProducts([
      Product.create({
        id: 'p1',
        slug: 'l',
        name: 'Lavanda',
        priceCents: 1800,
        stock: 3,
        lowStockThreshold: 1,
      }),
    ]);
    await orders.save(
      anOrder()
        .withItem({ unitPrice: Money.cents(1800), quantity: 2 })
        .build(),
    );
    gateway.payments.set('pay-1', { status: 'PENDING', orderId: 'o1' });
    useCase = new ConfirmPaymentUseCase(
      gateway,
      orders,
      products,
      products,
      new InMemoryProcessedPayments(),
      movements,
      outbox,
      new InlineUnitOfWork(),
    );
  });

  it('marks order paid, decreases stock and writes outbox event', async () => {
    gateway.approve('pay-1');
    await useCase.execute('pay-1');
    expect((await orders.findById('o1'))?.status).toBe('PAID');
    expect(products.items[0]?.stock).toBe(1);
    expect(movements.movements).toEqual([
      { productId: 'p1', delta: -2, reason: 'SALE', orderId: 'o1' },
    ]);
    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.type).toBe('OrderPaid');
  });

  it('is idempotent for repeated webhooks', async () => {
    gateway.approve('pay-1');
    await useCase.execute('pay-1');
    await useCase.execute('pay-1');
    expect(products.items[0]?.stock).toBe(1);
    expect(outbox.events).toHaveLength(1);
  });

  it('ignores payments not approved by the provider', async () => {
    await useCase.execute('pay-1');
    expect((await orders.findById('o1'))?.status).toBe('AWAITING_PAYMENT');
    expect(outbox.events).toHaveLength(0);
  });

  it('ignores unknown orders', async () => {
    gateway.payments.set('pay-x', { status: 'APPROVED', orderId: 'nope' });
    await useCase.execute('pay-x');
    expect(outbox.events).toHaveLength(0);
  });

  it('never sells beyond stock', async () => {
    products.items[0]?.decreaseStock(2);
    gateway.approve('pay-1');
    await expect(useCase.execute('pay-1')).rejects.toThrow(/Estoque/);
  });
});
