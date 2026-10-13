import type { OrderRepository } from '../domain/ports/index.js';

export class ExpireOrdersUseCase {
  constructor(
    private readonly orders: OrderRepository,
    private readonly ttlMinutes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Cancels unpaid orders whose payment window has passed. Returns how many were cancelled. */
  async execute(): Promise<number> {
    const limit = new Date(this.now().getTime() - this.ttlMinutes * 60_000);
    const expired = await this.orders.findAwaitingPaymentCreatedBefore(limit);
    for (const order of expired) {
      order.cancel();
      await this.orders.save(order);
    }
    return expired.length;
  }
}
