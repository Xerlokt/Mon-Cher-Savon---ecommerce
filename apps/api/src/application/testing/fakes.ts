import type { Order } from '../../domain/order/order.js';
import type { Product } from '../../domain/product/product.js';
import type {
  ChannelName,
  NotificationChannel,
  NotificationSetting,
  NotificationLogRepository,
  NotificationSettingsRepository,
  OrderRepository,
  OutboxEntry,
  OutboxQueue,
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
  readonly sent: Array<SaleNotification & { destination: string }> = [];
  constructor(
    readonly name: ChannelName,
    private readonly fail = false,
  ) {}
  async send(message: SaleNotification, destination: string): Promise<void> {
    if (this.fail) throw new Error('channel down');
    this.sent.push({ ...message, destination });
  }
}

export class FakeNotificationSettings implements NotificationSettingsRepository {
  readonly settings: NotificationSetting[];
  constructor(
    enabled: ChannelName[] = [],
    destinations: Partial<Record<ChannelName, string>> = {},
  ) {
    this.settings = (['telegram', 'whatsapp'] as const).map((channel) => ({
      channel,
      enabled: enabled.includes(channel),
      destination: destinations[channel] ?? `dest-${channel}`,
    }));
  }
  async enabledTargets() {
    return this.settings
      .filter((s) => s.enabled)
      .map(({ channel, destination }) => ({ channel, destination }));
  }
  async all() {
    return this.settings.map((s) => ({ ...s }));
  }
  async save(setting: NotificationSetting) {
    const index = this.settings.findIndex((s) => s.channel === setting.channel);
    if (index >= 0) this.settings[index] = { ...setting };
  }
}

export class InMemoryOutboxQueue implements OutboxQueue {
  readonly entries: Array<
    OutboxEntry & { status: 'PENDING' | 'SENT' | 'FAILED'; nextAttemptAt: Date }
  > = [];
  add(
    entry: { type: string; payload: Record<string, unknown>; attempts?: number },
    due = new Date(0),
  ) {
    const id = `e${this.entries.length + 1}`;
    this.entries.push({ id, attempts: 0, ...entry, status: 'PENDING', nextAttemptAt: due });
    return id;
  }
  async claimDue(limit: number, now: Date, leaseMs: number) {
    const due = this.entries
      .filter((e) => e.status === 'PENDING' && e.nextAttemptAt <= now)
      .slice(0, limit);
    for (const e of due) e.nextAttemptAt = new Date(now.getTime() + leaseMs);
    return due.map(({ id, type, payload, attempts }) => ({ id, type, payload, attempts }));
  }
  private get(id: string) {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error('unknown entry');
    return entry;
  }
  async markSent(id: string) {
    this.get(id).status = 'SENT';
  }
  async markRetry(id: string, attempts: number, nextAttemptAt: Date) {
    Object.assign(this.get(id), { attempts, nextAttemptAt, status: 'PENDING' });
  }
  async markFailed(id: string, attempts: number) {
    Object.assign(this.get(id), { attempts, status: 'FAILED' });
  }
}

export class FakeNotificationLog implements NotificationLogRepository {
  readonly records: Array<{ orderId: string; channels: string[]; ok: boolean[] }> = [];
  async record(orderId: string, channels: string[], results: PromiseSettledResult<void>[]) {
    this.records.push({ orderId, channels, ok: results.map((r) => r.status === 'fulfilled') });
  }
}
