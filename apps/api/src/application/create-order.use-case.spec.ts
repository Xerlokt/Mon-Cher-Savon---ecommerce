import { beforeEach, describe, expect, it } from 'vitest';
import { Product } from '../domain/product/product.js';
import {
  CreateOrderUseCase,
  PaymentRefusedError,
  type CreateOrderInput,
} from './create-order.use-case.js';
import { FakePaymentGateway, InMemoryOrders, InMemoryProducts } from './testing/fakes.js';

const product = (stock = 5) =>
  Product.create({
    id: 'p1',
    slug: 'lavanda',
    name: 'Lavanda',
    priceCents: 1800,
    stock,
    lowStockThreshold: 2,
  });

const input = (quantity = 2): CreateOrderInput => ({
  items: [{ productId: 'p1', quantity }],
  customer: { name: 'Maria', phone: '11900000000', email: 'm@example.com' },
  address: {
    cep: '01310-100',
    street: 'Rua A',
    number: '1',
    district: 'Centro',
    city: 'SP',
    state: 'SP',
  },
  shippingOption: 'LOCAL',
  paymentMethod: 'PIX',
});

describe('CreateOrderUseCase', () => {
  let orders: InMemoryOrders;
  let gateway: FakePaymentGateway;
  const build = (products: InMemoryProducts) =>
    new CreateOrderUseCase(
      products,
      orders,
      gateway,
      { PICKUP: 0, LOCAL: 1000, SHIPPING: 2500 },
      () => 'A7K2',
    );

  beforeEach(() => {
    orders = new InMemoryOrders();
    gateway = new FakePaymentGateway();
  });

  it('recalculates price from the database and creates the payment', async () => {
    const result = await build(new InMemoryProducts([product()])).execute(input(2));
    expect(result.publicCode).toBe('A7K2');
    expect(result.totalCents).toBe(4600);
    expect(result.payment.pixCopyPaste).toBeDefined();
    expect(orders.items[0]?.status).toBe('AWAITING_PAYMENT');
  });

  it('cancels the order and explains when the card is refused', async () => {
    gateway.refuseNext = true;
    const cardInput: CreateOrderInput = {
      ...input(2),
      paymentMethod: 'CARD',
      cardToken: 'tok',
      cardPaymentMethodId: 'visa',
    };
    await expect(
      build(new InMemoryProducts([product()])).execute(cardInput),
    ).rejects.toBeInstanceOf(PaymentRefusedError);
    expect(orders.items).toHaveLength(1);
    expect(orders.items[0]?.status).toBe('CANCELLED');
  });

  it('rejects unknown products', async () => {
    await expect(build(new InMemoryProducts()).execute(input())).rejects.toThrow(/não encontrado/);
  });

  it('rejects quantities above stock', async () => {
    await expect(build(new InMemoryProducts([product(1)])).execute(input(2))).rejects.toThrow(
      /Estoque/,
    );
  });

  it('rejects archived products', async () => {
    const archived = product();
    archived.archive();
    await expect(build(new InMemoryProducts([archived])).execute(input())).rejects.toThrow();
  });
});
