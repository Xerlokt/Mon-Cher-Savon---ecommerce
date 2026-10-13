import type {
  OutboxRepository,
  ProcessedPaymentRepository,
  StockMovementRepository,
} from '../../domain/ports/index.js';
import type { DbProvider } from './transactional-db.js';

export class PrismaProcessedPayments implements ProcessedPaymentRepository {
  constructor(private readonly provider: DbProvider) {}

  async markProcessed(providerPaymentId: string, orderId: string): Promise<boolean> {
    // ON CONFLICT DO NOTHING: a duplicate must not abort the surrounding transaction.
    const { count } = await this.provider.db.payment.createMany({
      data: [{ orderId, provider: 'mercadopago', providerPaymentId, status: 'approved' }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}

export class PrismaStockMovements implements StockMovementRepository {
  constructor(private readonly provider: DbProvider) {}

  async record(movement: Parameters<StockMovementRepository['record']>[0]): Promise<void> {
    await this.provider.db.stockMovement.create({
      data: {
        productId: movement.productId,
        delta: movement.delta,
        reason: movement.reason,
        orderId: movement.orderId ?? null,
      },
    });
  }
}

export class PrismaOutbox implements OutboxRepository {
  constructor(private readonly provider: DbProvider) {}

  async add(event: { type: string; payload: Record<string, unknown> }): Promise<void> {
    await this.provider.db.outboxEvent.create({
      data: { type: event.type, payload: event.payload as object },
    });
  }
}
