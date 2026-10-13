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
}

export interface PaymentGateway {
  createPayment(input: {
    orderId: string;
    amountCents: number;
    method: 'PIX' | 'CARD';
    payerEmail: string;
  }): Promise<{ providerPaymentId: string; pixCopyPaste?: string; pixQrCodeBase64?: string }>;
  getPayment(
    providerPaymentId: string,
  ): Promise<{ status: 'PENDING' | 'APPROVED' | 'REJECTED'; orderId: string }>;
}

export interface SaleNotification {
  text: string;
}

export interface NotificationChannel {
  readonly name: 'telegram' | 'whatsapp';
  send(message: SaleNotification): Promise<void>;
}

export interface NotificationSettingsRepository {
  enabledChannels(): Promise<Array<'telegram' | 'whatsapp'>>;
}

export interface NotificationLogRepository {
  record(orderId: string, channels: string[], results: PromiseSettledResult<void>[]): Promise<void>;
}
