import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BrowseCatalogUseCase } from './application/browse-catalog.use-case.js';
import { ConfirmPaymentUseCase } from './application/confirm-payment.use-case.js';
import { CreateOrderUseCase } from './application/create-order.use-case.js';
import { ExpireOrdersUseCase } from './application/expire-orders.use-case.js';
import { GetOrderStatusUseCase } from './application/get-order-status.use-case.js';
import { FakePaymentGateway } from './application/testing/fakes.js';
import { APP_CONFIG, loadConfig, type AppConfig } from './config.js';
import type { PaymentGateway } from './domain/ports/index.js';
import { generatePublicCode } from './domain/shared/public-code.js';
import { MercadoPagoGateway } from './infrastructure/mercadopago/mercadopago.gateway.js';
import { PrismaCatalogQuery } from './infrastructure/prisma/prisma-catalog.query.js';
import { PrismaOrderRepository } from './infrastructure/prisma/prisma-order.repository.js';
import {
  PrismaOutbox,
  PrismaProcessedPayments,
  PrismaStockMovements,
} from './infrastructure/prisma/prisma-payment-stock-outbox.repositories.js';
import { PrismaProductRepository } from './infrastructure/prisma/prisma-product.repository.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';
import { TransactionalDb } from './infrastructure/prisma/transactional-db.js';
import { OrderExpirationScheduler } from './infrastructure/scheduling/order-expiration.scheduler.js';
import { CatalogController } from './presentation/http/catalog.controller.js';
import { DomainExceptionFilter } from './presentation/http/domain-exception.filter.js';
import { OrdersController } from './presentation/http/orders.controller.js';
import { ShippingController } from './presentation/http/shipping.controller.js';
import { MP_WEBHOOK_SECRET, WebhooksController } from './presentation/http/webhooks.controller.js';

const TX = 'TRANSACTIONAL_DB';
const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

@Module({
  controllers: [CatalogController, OrdersController, ShippingController, WebhooksController],
  providers: [
    PrismaService,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    {
      provide: MP_WEBHOOK_SECRET,
      useFactory: (config: AppConfig) => config.MERCADOPAGO_WEBHOOK_SECRET ?? '',
      inject: [APP_CONFIG],
    },
    {
      provide: TX,
      useFactory: (prisma: PrismaService) => new TransactionalDb(prisma),
      inject: [PrismaService],
    },
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (config: AppConfig): PaymentGateway =>
        config.PAYMENT_MODE === 'fake'
          ? new FakePaymentGateway()
          : new MercadoPagoGateway({
              accessToken: config.MERCADOPAGO_ACCESS_TOKEN ?? '',
              notificationUrl: `${config.API_PUBLIC_URL}/api/v1/webhooks/mercadopago`,
              pixExpirationMinutes: config.ORDER_EXPIRATION_MINUTES,
            }),
      inject: [APP_CONFIG],
    },
    {
      provide: BrowseCatalogUseCase,
      useFactory: (prisma: PrismaService) =>
        new BrowseCatalogUseCase(new PrismaCatalogQuery(prisma)),
      inject: [PrismaService],
    },
    {
      provide: CreateOrderUseCase,
      useFactory: (tx: TransactionalDb, gateway: PaymentGateway, config: AppConfig) =>
        new CreateOrderUseCase(
          new PrismaProductRepository(tx),
          new PrismaOrderRepository(tx),
          gateway,
          {
            PICKUP: config.SHIPPING_PICKUP_CENTS,
            LOCAL: config.SHIPPING_LOCAL_CENTS,
            SHIPPING: config.SHIPPING_FLAT_CENTS,
          },
          generatePublicCode,
        ),
      inject: [TX, PAYMENT_GATEWAY, APP_CONFIG],
    },
    {
      provide: GetOrderStatusUseCase,
      useFactory: (tx: TransactionalDb) => new GetOrderStatusUseCase(new PrismaOrderRepository(tx)),
      inject: [TX],
    },
    {
      provide: ConfirmPaymentUseCase,
      useFactory: (tx: TransactionalDb, gateway: PaymentGateway) => {
        const products = new PrismaProductRepository(tx);
        return new ConfirmPaymentUseCase(
          gateway,
          new PrismaOrderRepository(tx),
          products,
          products,
          new PrismaProcessedPayments(tx),
          new PrismaStockMovements(tx),
          new PrismaOutbox(tx),
          tx,
        );
      },
      inject: [TX, PAYMENT_GATEWAY],
    },
    {
      provide: ExpireOrdersUseCase,
      useFactory: (tx: TransactionalDb, config: AppConfig) =>
        new ExpireOrdersUseCase(new PrismaOrderRepository(tx), config.ORDER_EXPIRATION_MINUTES),
      inject: [TX, APP_CONFIG],
    },
    {
      provide: OrderExpirationScheduler,
      useFactory: (expire: ExpireOrdersUseCase) => new OrderExpirationScheduler(expire),
      inject: [ExpireOrdersUseCase],
    },
  ],
})
export class AppModule {}
