import type {
  OrderRepository,
  OutboxRepository,
  PaymentGateway,
  ProcessedPaymentRepository,
  ProductReader,
  ProductWriter,
  StockMovementRepository,
  UnitOfWork,
} from '../domain/ports/index.js';

export class ConfirmPaymentUseCase {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly orders: OrderRepository,
    private readonly productReader: ProductReader,
    private readonly productWriter: ProductWriter,
    private readonly processed: ProcessedPaymentRepository,
    private readonly movements: StockMovementRepository,
    private readonly outbox: OutboxRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(providerPaymentId: string): Promise<void> {
    // Never trust the webhook body: ask the provider for the real status.
    const payment = await this.gateway.getPayment(providerPaymentId);
    if (payment.status !== 'APPROVED') return;

    await this.unitOfWork.run(async () => {
      const order = await this.orders.findById(payment.orderId);
      if (!order) return;
      if (!(await this.processed.markProcessed(providerPaymentId, order.id))) return;

      order.markAsPaid();
      const products = await this.productReader.findByIds(order.items.map((i) => i.productId));
      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        product.decreaseStock(item.quantity);
        await this.productWriter.save(product);
        await this.movements.record({
          productId: product.id,
          delta: -item.quantity,
          reason: 'SALE',
          orderId: order.id,
        });
      }
      await this.orders.save(order);
      for (const event of order.pullEvents()) {
        await this.outbox.add({
          type: event.type,
          payload: { orderId: event.orderId, publicCode: event.publicCode },
        });
      }
    });
  }
}
