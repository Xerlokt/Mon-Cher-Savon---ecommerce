import { DomainError } from '../domain/shared/domain-error.js';
import type { OrderRepository } from '../domain/ports/index.js';
import type { OrderStatus } from '../domain/order/order.js';

export class OrderNotFoundError extends DomainError {
  constructor() {
    super('Pedido não encontrado');
  }
}

export interface OrderStatusView {
  publicCode: string;
  status: OrderStatus;
  items: Array<{ productName: string; quantity: number; unitPriceCents: number }>;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
}

export class GetOrderStatusUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(publicCode: string): Promise<OrderStatusView> {
    const order = await this.orders.findByPublicCode(publicCode);
    if (!order) throw new OrderNotFoundError();
    return {
      publicCode: order.publicCode,
      status: order.status,
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPrice.cents,
      })),
      shippingCents: order.shipping.cents,
      totalCents: order.total.cents,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
