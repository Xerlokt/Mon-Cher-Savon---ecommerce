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
