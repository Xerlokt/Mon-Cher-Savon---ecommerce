import type { Order } from '../../domain/order/order.js';
import type { Product } from '../../domain/product/product.js';
import type {
  NotificationChannel,
  NotificationLogRepository,
  NotificationSettingsRepository,
  OrderRepository,
  OutboxRepository,
  PaymentGateway,
  ProcessedPaymentRepository,
  ProductReader,
  ProductWriter,
  SaleNotification,
  StockMovementRepository,
  UnitOfWork,
} from '../../domain/ports/index.js';

export class InMemoryProducts implements ProductReader, ProductWriter {
  constructor(readonly items: Product[] = []) {}
  async findActive(): Promise<Product[]> {
    return this.items.filter((p) => p.status === 'ACTIVE');
  }
  async findBySlug(slug: string): Promise<Product | null> {
    return this.items.find((p) => p.slug === slug && p.status === 'ACTIVE') ?? null;
  }
  async findByIds(ids: string[]): Promise<Product[]> {
    return this.items.filter((p) => ids.includes(p.id));
  }
  async save(product: Product): Promise<void> {
    if (!this.items.includes(product)) this.items.push(product);
  }
}

export class InMemoryOrders implements OrderRepository {
  readonly items: Order[] = [];
  async save(order: Order): Promise<void> {
    if (!this.items.includes(order)) this.items.push(order);
  }
  async findById(id: string): Promise<Order | null> {
    return this.items.find((o) => o.id === id) ?? null;
  }
  async findByPublicCode(code: string): Promise<Order | null> {
    return this.items.find((o) => o.publicCode === code) ?? null;
  }
  async findAwaitingPaymentCreatedBefore(date: Date): Promise<Order[]> {
    return this.items.filter((o) => o.status === 'AWAITING_PAYMENT' && o.createdAt < date);
  }
}

type PaymentState = { status: 'PENDING' | 'APPROVED' | 'REJECTED'; orderId: string };

export class FakePaymentGateway implements PaymentGateway {
  readonly payments = new Map<string, PaymentState>();
  async createPayment(input: { orderId: string }) {
    const providerPaymentId = `pay-${input.orderId}`;
    this.payments.set(providerPaymentId, { status: 'PENDING', orderId: input.orderId });
    return { providerPaymentId, pixCopyPaste: '000201pix' };
  }
  async getPayment(id: string): Promise<PaymentState> {
    const payment = this.payments.get(id);
    if (!payment) throw new Error('payment not found');
    return payment;
  }
  approve(id: string): void {
    const payment = this.payments.get(id);
    if (payment) payment.status = 'APPROVED';
  }
}

export class InlineUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

export class InMemoryProcessedPayments implements ProcessedPaymentRepository {
  private readonly seen = new Set<string>();
  async markProcessed(id: string): Promise<boolean> {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }
}

type Movement = Parameters<StockMovementRepository['record']>[0];

export class InMemoryStockMovements implements StockMovementRepository {
  readonly movements: Movement[] = [];
  async record(movement: Movement): Promise<void> {
    this.movements.push(movement);
  }
}

export class InMemoryOutbox implements OutboxRepository {
  readonly events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  async add(event: { type: string; payload: Record<string, unknown> }): Promise<void> {
    this.events.push(event);
  }
}

export class FakeChannel implements NotificationChannel {
  readonly sent: SaleNotification[] = [];
  constructor(
    readonly name: 'telegram' | 'whatsapp',
    private readonly fail = false,
  ) {}
  async send(message: SaleNotification): Promise<void> {
    if (this.fail) throw new Error('channel down');
    this.sent.push(message);
  }
}

export class FakeNotificationSettings implements NotificationSettingsRepository {
  constructor(private readonly enabled: Array<'telegram' | 'whatsapp'>) {}
  async enabledChannels() {
    return this.enabled;
  }
}

export class FakeNotificationLog implements NotificationLogRepository {
  readonly records: Array<{ orderId: string; channels: string[]; ok: boolean[] }> = [];
  async record(orderId: string, channels: string[], results: PromiseSettledResult<void>[]) {
    this.records.push({ orderId, channels, ok: results.map((r) => r.status === 'fulfilled') });
  }
}
