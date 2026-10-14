import type { Order } from '../../domain/order/order.js';
import type { Product } from '../../domain/product/product.js';
import type { AdminProductView } from '@mon-cher-savon/contracts';
import type {
  AdminProductRepository,
  AdminUserRecord,
  AdminUserRepository,
  ChannelName,
  LoginThrottle,
  PasswordHasher,
  SessionTokens,
  NotificationChannel,
  NotificationSetting,
  NotificationLogRepository,
  NotificationSettingsRepository,
  OrderPaymentReader,
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
  readonly refunded: string[] = [];
  /** Set to make the next refund fail, like a provider outage. */
  failRefund = false;
  async refundPayment(id: string): Promise<void> {
    if (this.failRefund) throw new Error('provider down');
    if (!this.refunded.includes(id)) this.refunded.push(id);
  }
}

export class InMemoryOrderPayments implements OrderPaymentReader {
  readonly byOrder = new Map<string, string>();
  async findApprovedPaymentId(orderId: string): Promise<string | null> {
    return this.byOrder.get(orderId) ?? null;
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

export class InMemoryAdmins implements AdminUserRepository {
  constructor(private readonly admins: AdminUserRecord[] = []) {}
  async findByEmail(email: string) {
    return this.admins.find((a) => a.email === email) ?? null;
  }
  async findById(id: string) {
    return this.admins.find((a) => a.id === id) ?? null;
  }
}

/** hash:<plain> — deterministic, only for tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hash:${plain}`;
  }
  async verify(hash: string, plain: string) {
    return hash === `hash:${plain}`;
  }
}

export class FakeSessionTokens implements SessionTokens {
  async issue(adminId: string, remember: boolean) {
    return { token: `token:${adminId}`, maxAgeSeconds: remember ? 30 * 24 * 3600 : null };
  }
  async verify(token: string | undefined) {
    return token?.startsWith('token:') ? { adminId: token.slice(6) } : null;
  }
}

export class InMemoryLoginThrottle implements LoginThrottle {
  private readonly failures = new Map<string, number>();
  constructor(private readonly maxFailures = 5) {}
  retryAfterSeconds(key: string) {
    return (this.failures.get(key) ?? 0) >= this.maxFailures ? 900 : 0;
  }
  recordFailure(key: string) {
    this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
  }
  reset(key: string) {
    this.failures.delete(key);
  }
}

export class InMemoryAdminProducts implements AdminProductRepository {
  private readonly products = new Map<string, AdminProductView>();
  private readonly ingredientSlugs = new Set<string>();
  private seq = 0;

  async list() {
    return [...this.products.values()];
  }
  async get(id: string) {
    return this.products.get(id) ?? null;
  }
  async slugExists(slug: string) {
    return [...this.products.values()].some((p) => p.slug === slug);
  }
  async create(data: Parameters<AdminProductRepository['create']>[0]) {
    const view: AdminProductView = {
      id: `ap${++this.seq}`,
      slug: data.slug,
      name: data.name,
      description: data.description,
      usage: data.usage,
      aroma: data.aroma,
      priceCents: data.priceCents,
      weightGrams: data.weightGrams,
      stock: data.stock,
      lowStockThreshold: data.lowStockThreshold,
      lowStock: data.stock <= data.lowStockThreshold,
      status: 'ACTIVE',
      images: data.images,
      ingredientIds: data.ingredientIds,
    };
    this.products.set(view.id, view);
    return view;
  }
  async update(id: string, patch: Parameters<AdminProductRepository['update']>[1]) {
    const current = this.products.get(id);
    if (!current) return null;
    const next = { ...current, ...patch } as AdminProductView;
    this.products.set(id, next);
    return next;
  }
  async setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED') {
    const current = this.products.get(id);
    if (!current) return false;
    this.products.set(id, { ...current, status });
    return true;
  }
  async createIngredient(data: { name: string; slug: string; benefit: string }) {
    this.ingredientSlugs.add(data.slug);
    return { id: `ing-${data.slug}`, ...data };
  }
  async slugExistsIngredient(slug: string) {
    return this.ingredientSlugs.has(slug);
  }
}
