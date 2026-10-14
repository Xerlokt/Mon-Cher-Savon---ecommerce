import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidOrderTransitionError, OrderNotPaidError } from '../domain/order/errors.js';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { Money } from '../domain/shared/money.js';
import { Product } from '../domain/product/product.js';
import {
  ChangeOrderStatusUseCase,
  NoPaymentToRefundError,
  RefundOrderUseCase,
} from './admin-orders.use-cases.js';
import { OrderNotFoundError } from './get-order-status.use-case.js';
import {
  FakePaymentGateway,
  InMemoryOrderPayments,
  InMemoryOrders,
  InMemoryProducts,
  InMemoryStockMovements,
  InlineUnitOfWork,
} from './testing/fakes.js';

describe('ChangeOrderStatusUseCase', () => {
  let orders: InMemoryOrders;
  let products: InMemoryProducts;
  let movements: InMemoryStockMovements;
  let useCase: ChangeOrderStatusUseCase;

  beforeEach(() => {
    orders = new InMemoryOrders();
    movements = new InMemoryStockMovements();
    products = new InMemoryProducts([
      Product.create({
        id: 'p1',
        slug: 'l',
        name: 'Lavanda',
        priceCents: 1800,
        stock: 1,
        lowStockThreshold: 1,
      }),
    ]);
    useCase = new ChangeOrderStatusUseCase(
      orders,
      products,
      products,
      movements,
      new InlineUnitOfWork(),
    );
  });

  const paid = () =>
    anOrder()
      .withItem({ unitPrice: Money.cents(1800), quantity: 2, productId: 'p1' })
      .paid()
      .build();

  it('marks a paid order as shipped, then delivered', async () => {
    await orders.save(paid());
    await useCase.execute('o1', 'SHIPPED');
    expect((await orders.findById('o1'))?.status).toBe('SHIPPED');
    await useCase.execute('o1', 'DELIVERED');
    expect((await orders.findById('o1'))?.status).toBe('DELIVERED');
  });

  it('refuses to ship an order that was not paid', async () => {
    await orders.save(anOrder().pendingPayment().build());
    await expect(useCase.execute('o1', 'SHIPPED')).rejects.toBeInstanceOf(OrderNotPaidError);
  });

  it('rejects invalid transitions', async () => {
    await orders.save(paid());
    await expect(useCase.execute('o1', 'DELIVERED')).rejects.toBeInstanceOf(
      InvalidOrderTransitionError,
    );
  });

  it('puts stock back when a paid order is cancelled', async () => {
    await orders.save(paid());
    await useCase.execute('o1', 'CANCELLED');
    expect((await orders.findById('o1'))?.status).toBe('CANCELLED');
    expect(products.items[0]?.stock).toBe(3);
    expect(movements.movements).toEqual([
      { productId: 'p1', delta: 2, reason: 'RESTOCK', orderId: 'o1' },
    ]);
  });

  it('does not touch stock when an unpaid order is cancelled', async () => {
    await orders.save(anOrder().pendingPayment().build());
    await useCase.execute('o1', 'CANCELLED');
    expect(products.items[0]?.stock).toBe(1);
    expect(movements.movements).toEqual([]);
  });

  it('fails for unknown orders', async () => {
    await expect(useCase.execute('ghost', 'SHIPPED')).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('RefundOrderUseCase', () => {
  let orders: InMemoryOrders;
  let products: InMemoryProducts;
  let movements: InMemoryStockMovements;
  let gateway: FakePaymentGateway;
  let payments: InMemoryOrderPayments;
  let useCase: RefundOrderUseCase;

  beforeEach(() => {
    orders = new InMemoryOrders();
    movements = new InMemoryStockMovements();
    gateway = new FakePaymentGateway();
    payments = new InMemoryOrderPayments();
    payments.byOrder.set('o1', 'mp-1');
    products = new InMemoryProducts([
      Product.create({
        id: 'p1',
        slug: 'l',
        name: 'Lavanda',
        priceCents: 1800,
        stock: 1,
        lowStockThreshold: 1,
      }),
    ]);
    useCase = new RefundOrderUseCase(
      orders,
      payments,
      gateway,
      products,
      products,
      movements,
      new InlineUnitOfWork(),
    );
  });

  const build = () =>
    anOrder().withItem({ unitPrice: Money.cents(1800), quantity: 2, productId: 'p1' });

  it('refunds at the provider, marks the order and returns the stock when it was not shipped', async () => {
    await orders.save(build().paid().build());
    await useCase.execute('o1');
    expect(gateway.refunded).toEqual(['mp-1']);
    expect((await orders.findById('o1'))?.status).toBe('REFUNDED');
    expect(products.items[0]?.stock).toBe(3);
    expect(movements.movements).toHaveLength(1);
  });

  it('keeps the stock untouched when the soaps already left (shipped or delivered)', async () => {
    await orders.save(build().shipped().build());
    await useCase.execute('o1');
    expect((await orders.findById('o1'))?.status).toBe('REFUNDED');
    expect(products.items[0]?.stock).toBe(1);
    expect(movements.movements).toHaveLength(0);
  });

  it('does not call the provider for an order that cannot be refunded', async () => {
    await orders.save(build().pendingPayment().build());
    await expect(useCase.execute('o1')).rejects.toBeInstanceOf(InvalidOrderTransitionError);
    expect(gateway.refunded).toEqual([]);
  });

  it('does not refund twice', async () => {
    await orders.save(build().paid().build());
    await useCase.execute('o1');
    await expect(useCase.execute('o1')).rejects.toBeInstanceOf(InvalidOrderTransitionError);
    expect(gateway.refunded).toEqual(['mp-1']);
  });

  it('keeps the order untouched when the provider fails, so the seller can retry', async () => {
    await orders.save(build().paid().build());
    gateway.failRefund = true;
    await expect(useCase.execute('o1')).rejects.toThrow('provider down');
    expect((await orders.findById('o1'))?.status).toBe('PAID');
    expect(products.items[0]?.stock).toBe(1);
  });

  it('explains when there is no confirmed payment to refund', async () => {
    payments.byOrder.clear();
    await orders.save(build().paid().build());
    await expect(useCase.execute('o1')).rejects.toBeInstanceOf(NoPaymentToRefundError);
  });

  it('reports an unknown order', async () => {
    await expect(useCase.execute('nope')).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
