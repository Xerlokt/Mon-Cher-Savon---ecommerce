import { describe, expect, it } from 'vitest';
import { Money } from '../domain/shared/money.js';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { GetOrderStatusUseCase, OrderNotFoundError } from './get-order-status.use-case.js';
import { InMemoryOrders } from './testing/fakes.js';

describe('GetOrderStatusUseCase', () => {
  it('returns a public view without personal data', async () => {
    const orders = new InMemoryOrders();
    await orders.save(
      anOrder()
        .withItem({ unitPrice: Money.cents(1800), quantity: 2, productName: 'Lavanda' })
        .withShipping(Money.cents(1000))
        .paid()
        .build(),
    );
    const view = await new GetOrderStatusUseCase(orders).execute('A7K2');
    expect(view).toMatchObject({
      publicCode: 'A7K2',
      status: 'PAID',
      totalCents: 4600,
      shippingCents: 1000,
      items: [{ productName: 'Lavanda', quantity: 2, unitPriceCents: 1800 }],
    });
    expect(JSON.stringify(view)).not.toContain('Maria');
    expect(JSON.stringify(view)).not.toContain('example.com');
  });

  it('fails for unknown codes', async () => {
    await expect(
      new GetOrderStatusUseCase(new InMemoryOrders()).execute('ZZZZ'),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
