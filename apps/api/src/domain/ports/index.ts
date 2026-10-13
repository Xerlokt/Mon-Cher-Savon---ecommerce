import type { Order } from '../order/order.js';
import type { Product } from '../product/product.js';
import type { Ingredient } from '../product/ingredient.js';

export interface ProductReader {
  findActive(filter?: { ingredientId?: string }): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | null>;
  findByIds(ids: string[]): Promise<Product[]>;
}

export interface ProductWriter {
  save(product: Product): Promise<void>;
}

export interface IngredientReader {
  findAll(): Promise<Ingredient[]>;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByPublicCode(code: string): Promise<Order | null>;
  findAwaitingPaymentCreatedBefore(date: Date): Promise<Order[]>;
}

export interface PaymentGateway {
  createPayment(input: {
    orderId: string;
    amountCents: number;
    method: 'PIX' | 'CARD';
    payerEmail: string;
    cardToken?: string;
    cardPaymentMethodId?: string;
  }): Promise<{ providerPaymentId: string; pixCopyPaste?: string; pixQrCodeBase64?: string }>;
  getPayment(
    providerPaymentId: string,
  ): Promise<{ status: 'PENDING' | 'APPROVED' | 'REJECTED'; orderId: string }>;
}

export interface SaleNotification {
  text: string;
}

export type ChannelName = 'telegram' | 'whatsapp';

export interface NotificationChannel {
  readonly name: ChannelName;
  send(message: SaleNotification, destination: string): Promise<void>;
}

export interface NotificationSetting {
  channel: ChannelName;
  enabled: boolean;
  destination: string;
}

export interface NotificationSettingsRepository {
  enabledTargets(): Promise<Array<{ channel: ChannelName; destination: string }>>;
  all(): Promise<NotificationSetting[]>;
  save(setting: NotificationSetting): Promise<void>;
}

export interface OutboxEntry {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/** Worker side of the outbox: claims due events with a lease so crashed workers are retried. */
export interface OutboxQueue {
  claimDue(limit: number, now: Date, leaseMs: number): Promise<OutboxEntry[]>;
  markSent(id: string): Promise<void>;
  markRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void>;
  markFailed(id: string, attempts: number): Promise<void>;
}

export interface NotificationLogRepository {
  record(orderId: string, channels: string[], results: PromiseSettledResult<void>[]): Promise<void>;
}

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface ProcessedPaymentRepository {
  /** Returns false when this provider payment was already processed (idempotency). */
  markProcessed(providerPaymentId: string, orderId: string): Promise<boolean>;
}

export interface StockMovementRepository {
  record(movement: {
    productId: string;
    delta: number;
    reason: 'SALE' | 'RESTOCK' | 'ADJUSTMENT';
    orderId?: string;
  }): Promise<void>;
}

export interface OutboxRepository {
  add(event: { type: string; payload: Record<string, unknown> }): Promise<void>;
}

export interface IngredientView {
  id: string;
  slug: string;
  name: string;
  benefit: string;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  aroma: string;
  imageUrl: string | null;
  soldOut: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  usage: string;
  weightGrams: number;
  images: string[];
  ingredients: IngredientView[];
}

export interface CatalogFilter {
  ingredient?: string;
  aroma?: string;
  benefit?: string;
}

/** Read model for the storefront (CQRS-lite): returns DTOs, never entities. */
export interface CatalogQuery {
  listProducts(filter: CatalogFilter): Promise<ProductSummary[]>;
  getProductBySlug(slug: string): Promise<ProductDetail | null>;
  listIngredients(): Promise<IngredientView[]>;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUserRecord | null>;
  findById(id: string): Promise<AdminUserRecord | null>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface SessionTokens {
  issue(
    adminId: string,
    remember: boolean,
  ): Promise<{ token: string; maxAgeSeconds: number | null }>;
  verify(token: string | undefined): Promise<{ adminId: string } | null>;
}

export interface LoginThrottle {
  /** Seconds until another attempt is allowed, or 0 when not blocked. */
  retryAfterSeconds(key: string): number;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export interface AdminOrderQuery {
  list(status?: string): Promise<import('@mon-cher-savon/contracts').AdminOrderSummary[]>;
  getByPublicCode(
    code: string,
  ): Promise<import('@mon-cher-savon/contracts').AdminOrderDetail | null>;
}

type ProductContent = Omit<import('@mon-cher-savon/contracts').ProductInput, 'stock'>;

export interface AdminProductRepository {
  list(): Promise<import('@mon-cher-savon/contracts').AdminProductView[]>;
  get(id: string): Promise<import('@mon-cher-savon/contracts').AdminProductView | null>;
  slugExists(slug: string): Promise<boolean>;
  create(
    data: ProductContent & { slug: string; stock: number },
  ): Promise<import('@mon-cher-savon/contracts').AdminProductView>;
  update(
    id: string,
    patch: Partial<ProductContent>,
  ): Promise<import('@mon-cher-savon/contracts').AdminProductView | null>;
  setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED'): Promise<boolean>;
  createIngredient(data: { name: string; slug: string; benefit: string }): Promise<IngredientView>;
  slugExistsIngredient(slug: string): Promise<boolean>;
}

export interface ImageStorage {
  save(data: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<{ url: string }>;
}

export interface DashboardRaw {
  /** Days with sales only (YYYY-MM-DD in São Paulo time). */
  byDay: Array<{ day: string; salesCount: number; revenueCents: number }>;
  topProducts: Array<{ name: string; quantity: number; revenueCents: number }>;
  topIngredients: Array<{ name: string; quantity: number }>;
  lowStock: Array<{ id: string; name: string; stock: number }>;
}

/** Read model for the seller dashboard; aggregation happens in the database. */
export interface DashboardQuery {
  aggregate(from: Date, to: Date): Promise<DashboardRaw>;
}
