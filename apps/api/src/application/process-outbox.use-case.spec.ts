import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anOrder } from '../domain/order/testing/order.builder.js';
import { ProcessOutboxUseCase } from './process-outbox.use-case.js';
import { InMemoryOrders, InMemoryOutboxQueue } from './testing/fakes.js';

const T0 = new Date('2026-01-01T12:00:00Z');

describe('ProcessOutboxUseCase', () => {
  let queue: InMemoryOutboxQueue;
  let orders: InMemoryOrders;
  let notify: { execute: ReturnType<typeof vi.fn> };
  let clock: Date;
  const build = () =>
    new ProcessOutboxUseCase(queue, orders, notify, { batchSize: 10, maxAttempts: 3 }, () => clock);

  beforeEach(async () => {
    queue = new InMemoryOutboxQueue();
    orders = new InMemoryOrders();
    notify = { execute: vi.fn().mockResolvedValue(undefined) };
    clock = T0;
    await orders.save(anOrder().paid().build());
  });

  it('notifies the sale and marks the event as sent', async () => {
    const id = queue.add({ type: 'OrderPaid', payload: { orderId: 'o1', publicCode: 'A7K2' } });
    const result = await build().execute();
    expect(result).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(notify.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }));
    expect(queue.entries.find((e) => e.id === id)?.status).toBe('SENT');
  });

  it('does not process the same event twice while it is leased', async () => {
    queue.add({ type: 'OrderPaid', payload: { orderId: 'o1' } });
    await build().execute();
    await build().execute();
    expect(notify.execute).toHaveBeenCalledTimes(1);
  });

  it('retries with growing backoff and fails after the third attempt', async () => {
    notify.execute.mockRejectedValue(new Error('telegram down'));
    const id = queue.add({ type: 'OrderPaid', payload: { orderId: 'o1' } });
    const entry = () => queue.entries.find((e) => e.id === id)!;

    expect(await build().execute()).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(entry()).toMatchObject({ attempts: 1, status: 'PENDING' });
    const first = entry().nextAttemptAt.getTime() - T0.getTime();

    // not due yet
    expect(await build().execute()).toEqual({ sent: 0, retried: 0, failed: 0 });

    clock = new Date(entry().nextAttemptAt.getTime());
    expect(await build().execute()).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(entry().attempts).toBe(2);
    expect(entry().nextAttemptAt.getTime() - clock.getTime()).toBeGreaterThan(first);

    clock = new Date(entry().nextAttemptAt.getTime());
    expect(await build().execute()).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(entry()).toMatchObject({ attempts: 3, status: 'FAILED' });
    expect(notify.execute).toHaveBeenCalledTimes(3);
  });

  it('fails events whose order is missing or whose type is unknown without notifying', async () => {
    queue.add({ type: 'OrderPaid', payload: { orderId: 'ghost' } });
    queue.add({ type: 'SomethingElse', payload: {} });
    const result = await build().execute();
    expect(result).toEqual({ sent: 0, retried: 0, failed: 2 });
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('respects the batch size', async () => {
    for (let i = 0; i < 3; i++) queue.add({ type: 'OrderPaid', payload: { orderId: 'o1' } });
    const small = new ProcessOutboxUseCase(queue, orders, notify, { batchSize: 2 }, () => clock);
    expect((await small.execute()).sent).toBe(2);
  });
});
