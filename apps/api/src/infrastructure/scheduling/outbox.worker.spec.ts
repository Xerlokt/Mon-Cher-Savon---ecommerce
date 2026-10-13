import { describe, expect, it, vi } from 'vitest';
import type { ProcessOutboxUseCase } from '../../application/process-outbox.use-case.js';
import { OutboxWorker } from './outbox.worker.js';

const useCase = (execute: () => Promise<{ sent: number; retried: number; failed: number }>) =>
  ({ execute }) as unknown as ProcessOutboxUseCase;

describe('OutboxWorker', () => {
  it('does not overlap ticks while one is still running', async () => {
    let release: () => void = () => undefined;
    const execute = vi.fn(
      () =>
        new Promise<{ sent: number; retried: number; failed: number }>((resolve) => {
          release = () => resolve({ sent: 1, retried: 0, failed: 0 });
        }),
    );
    const worker = new OutboxWorker(useCase(execute), 1000, true);
    const first = worker.tick();
    await worker.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await first;
    const third = worker.tick();
    release();
    await third;
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('survives a failing run and keeps ticking', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue({ sent: 0, retried: 0, failed: 0 });
    const worker = new OutboxWorker(useCase(execute), 1000, true);
    await expect(worker.tick()).resolves.toBeUndefined();
    await worker.tick();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('only schedules polling when enabled', async () => {
    vi.useFakeTimers();
    const execute = vi.fn().mockResolvedValue({ sent: 0, retried: 0, failed: 0 });
    const off = new OutboxWorker(useCase(execute), 1000, false);
    off.onModuleInit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(execute).not.toHaveBeenCalled();

    const on = new OutboxWorker(useCase(execute), 1000, true);
    on.onModuleInit();
    await vi.advanceTimersByTimeAsync(2100);
    expect(execute).toHaveBeenCalledTimes(2);
    on.onModuleDestroy();
    vi.useRealTimers();
  });
});
