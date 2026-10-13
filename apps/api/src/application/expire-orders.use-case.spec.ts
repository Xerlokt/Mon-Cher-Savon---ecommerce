import { describe, expect, it } from 'vitest';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { ExpireOrdersUseCase } from './expire-orders.use-case.js';
import { InMemoryOrders } from './testing/fakes.js';

const now = new Date('2026-01-01T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('ExpireOrdersUseCase', () => {
  it('cancels only unpaid orders older than the ttl', async () => {
    const orders = new InMemoryOrders();
    await orders.save(anOrder().createdAt(minutesAgo(45)).pendingPayment().withId('old').build());
    await orders.save(anOrder().createdAt(minutesAgo(5)).pendingPayment().withId('fresh').build());
    await orders.save(anOrder().createdAt(minutesAgo(90)).paid().withId('paid').build());

    const cancelled = await new ExpireOrdersUseCase(orders, 30, () => now).execute();

    expect(cancelled).toBe(1);
    expect((await orders.findById('old'))?.status).toBe('CANCELLED');
    expect((await orders.findById('fresh'))?.status).toBe('AWAITING_PAYMENT');
    expect((await orders.findById('paid'))?.status).toBe('PAID');
  });
});
