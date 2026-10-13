import type {
  OrderRepository,
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
