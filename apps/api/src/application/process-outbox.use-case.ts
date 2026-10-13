import type { Order } from '../domain/order/order.js';
import type { OrderRepository, OutboxQueue } from '../domain/ports/index.js';

export interface ProcessOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
  /** How long a claimed event stays invisible to other workers. */
  leaseMs?: number;
  /** Delay before the next attempt, given how many attempts already failed. */
  backoffMs?: (failedAttempts: number) => number;
}

export interface ProcessOutboxResult {
  sent: number;
  retried: number;
  failed: number;
}

export class ProcessOutboxUseCase {
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly leaseMs: number;
  private readonly backoffMs: (failedAttempts: number) => number;

  constructor(
    private readonly queue: OutboxQueue,
    private readonly orders: OrderRepository,
    private readonly notifySale: { execute(order: Order): Promise<void> },
    options: ProcessOutboxOptions = {},
    private readonly now: () => Date = () => new Date(),
  ) {
    this.batchSize = options.batchSize ?? 10;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.leaseMs = options.leaseMs ?? 5 * 60_000;
    this.backoffMs = options.backoffMs ?? ((n) => 30_000 * 2 ** (n - 1));
  }

  async execute(): Promise<ProcessOutboxResult> {
    const result: ProcessOutboxResult = { sent: 0, retried: 0, failed: 0 };
    const entries = await this.queue.claimDue(this.batchSize, this.now(), this.leaseMs);

    for (const entry of entries) {
      if (entry.type !== 'OrderPaid') {
        await this.queue.markFailed(entry.id, entry.attempts);
        result.failed++;
        continue;
      }
      const attempts = entry.attempts + 1;
      try {
        const orderId = String(entry.payload['orderId'] ?? '');
        const order = await this.orders.findById(orderId);
        if (!order) {
          await this.queue.markFailed(entry.id, attempts);
          result.failed++;
          continue;
        }
        await this.notifySale.execute(order);
        await this.queue.markSent(entry.id);
        result.sent++;
      } catch {
        if (attempts >= this.maxAttempts) {
          await this.queue.markFailed(entry.id, attempts);
          result.failed++;
        } else {
          const next = new Date(this.now().getTime() + this.backoffMs(attempts));
          await this.queue.markRetry(entry.id, attempts, next);
          result.retried++;
        }
      }
    }
    return result;
  }
}
