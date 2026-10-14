import { DomainError } from '../domain/shared/domain-error.js';
import type {
  OrderPaymentReader,
  OrderRepository,
  PaymentGateway,
  ProductReader,
  ProductWriter,
  StockMovementRepository,
  UnitOfWork,
} from '../domain/ports/index.js';
import { OrderNotFoundError } from './get-order-status.use-case.js';

export type ManualOrderStatus = 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export class ChangeOrderStatusUseCase {
  constructor(
    private readonly orders: OrderRepository,
    private readonly productReader: ProductReader,
    private readonly productWriter: ProductWriter,
    private readonly movements: StockMovementRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(orderId: string, status: ManualOrderStatus): Promise<void> {
    await this.unitOfWork.run(async () => {
      const order = await this.orders.findById(orderId);
      if (!order) throw new OrderNotFoundError();

      const wasPaid = order.status === 'PAID';
      if (status === 'SHIPPED') order.markAsShipped();
      else if (status === 'DELIVERED') order.markAsDelivered();
      else order.cancel();

      if (status === 'CANCELLED' && wasPaid) {
        // Stock was taken when the payment was confirmed: give it back.
        const products = await this.productReader.findByIds(order.items.map((i) => i.productId));
        for (const item of order.items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product) continue;
          product.increaseStock(item.quantity);
          await this.productWriter.save(product);
          await this.movements.record({
            productId: product.id,
            delta: item.quantity,
            reason: 'RESTOCK',
            orderId: order.id,
          });
        }
      }
      await this.orders.save(order);
    });
  }
}

export class NoPaymentToRefundError extends DomainError {
  constructor() {
    super(
      'Não encontramos um pagamento confirmado para devolver. Faça o reembolso no Mercado Pago.',
    );
  }
}

/**
 * Gives the customer's money back through the payment provider, then marks the order as refunded.
 * The provider is called first and only once the order is known to be refundable. If the provider
 * works but saving fails, trying again is safe: the provider treats the repeated refund as the same one.
 */
export class RefundOrderUseCase {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: OrderPaymentReader,
    private readonly gateway: PaymentGateway,
    private readonly productReader: ProductReader,
    private readonly productWriter: ProductWriter,
    private readonly movements: StockMovementRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new OrderNotFoundError();
    // Throws the domain error for orders that cannot be refunded, before touching the provider.
    if (!order.isRefundable) order.refund();

    const paymentId = await this.payments.findApprovedPaymentId(order.id);
    if (!paymentId) throw new NoPaymentToRefundError();

    await this.gateway.refundPayment(paymentId);

    await this.unitOfWork.run(async () => {
      const current = await this.orders.findById(orderId);
      if (!current) throw new OrderNotFoundError();
      const wasPaid = current.status === 'PAID'; // not shipped yet: the soaps are still here
      current.refund();
      if (wasPaid) {
        const products = await this.productReader.findByIds(current.items.map((i) => i.productId));
        for (const item of current.items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product) continue;
          product.increaseStock(item.quantity);
          await this.productWriter.save(product);
          await this.movements.record({
            productId: product.id,
            delta: item.quantity,
            reason: 'RESTOCK',
            orderId: current.id,
          });
        }
      }
      await this.orders.save(current);
    });
  }
}
