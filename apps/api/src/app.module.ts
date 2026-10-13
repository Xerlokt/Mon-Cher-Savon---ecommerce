import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BrowseCatalogUseCase } from './application/browse-catalog.use-case.js';
import { ConfirmPaymentUseCase } from './application/confirm-payment.use-case.js';
import { CreateOrderUseCase } from './application/create-order.use-case.js';
import {
  GetNotificationSettingsUseCase,
  SendTestNotificationUseCase,
  UpdateNotificationSettingUseCase,
} from './application/notification-settings.use-cases.js';
import { NotifySaleUseCase } from './application/notify-sale.use-case.js';
import { ProcessOutboxUseCase } from './application/process-outbox.use-case.js';
import { ExpireOrdersUseCase } from './application/expire-orders.use-case.js';
import { GetOrderStatusUseCase } from './application/get-order-status.use-case.js';
import { FakePaymentGateway } from './application/testing/fakes.js';
import { APP_CONFIG, loadConfig, type AppConfig } from './config.js';
import type { ChannelName, NotificationChannel, PaymentGateway } from './domain/ports/index.js';
import { generatePublicCode } from './domain/shared/public-code.js';
import { MercadoPagoGateway } from './infrastructure/mercadopago/mercadopago.gateway.js';
import { TelegramChannel } from './infrastructure/notifications/telegram.channel.js';
import { WhatsAppChannel } from './infrastructure/notifications/whatsapp.channel.js';
import {
  PrismaNotificationLog,
  PrismaNotificationSettings,
  PrismaOutboxQueue,
} from './infrastructure/prisma/prisma-notification.repositories.js';
import { OutboxWorker } from './infrastructure/scheduling/outbox.worker.js';
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
import { ADMIN_BOOTSTRAP_TOKEN, AdminGuard } from './presentation/http/admin.guard.js';
import { NotificationsController } from './presentation/http/notifications.controller.js';
import { CatalogController } from './presentation/http/catalog.controller.js';
import { DomainExceptionFilter } from './presentation/http/domain-exception.filter.js';
import { OrdersController } from './presentation/http/orders.controller.js';
import { ShippingController } from './presentation/http/shipping.controller.js';
import { MP_WEBHOOK_SECRET, WebhooksController } from './presentation/http/webhooks.controller.js';

const TX = 'TRANSACTIONAL_DB';
const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';
const CHANNELS = 'NOTIFICATION_CHANNELS';

@Module({
  controllers: [
    CatalogController,
    OrdersController,
    ShippingController,
    WebhooksController,
    NotificationsController,
  ],
  providers: [
    PrismaService,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    {
      provide: MP_WEBHOOK_SECRET,
      useFactory: (config: AppConfig) => config.MERCADOPAGO_WEBHOOK_SECRET ?? '',
      inject: [APP_CONFIG],
    },
    AdminGuard,
    {
      provide: ADMIN_BOOTSTRAP_TOKEN,
      useFactory: (config: AppConfig) => config.ADMIN_BOOTSTRAP_TOKEN ?? '',
      inject: [APP_CONFIG],
    },
    {
      provide: CHANNELS,
      useFactory: (config: AppConfig): NotificationChannel[] => {
        const channels: NotificationChannel[] = [];
        if (config.TELEGRAM_BOT_TOKEN) {
          channels.push(
            new TelegramChannel({
              botToken: config.TELEGRAM_BOT_TOKEN,
              ...(config.TELEGRAM_API_BASE_URL ? { baseUrl: config.TELEGRAM_API_BASE_URL } : {}),
            }),
          );
        }
        if (config.WHATSAPP_CLOUD_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID) {
          channels.push(
            new WhatsAppChannel({
              accessToken: config.WHATSAPP_CLOUD_TOKEN,
              phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
              templateName: config.WHATSAPP_TEMPLATE_NAME,
            }),
          );
        }
        return channels;
      },
      inject: [APP_CONFIG],
    },
    {
      provide: GetNotificationSettingsUseCase,
      useFactory: (prisma: PrismaService, channels: NotificationChannel[]) =>
        new GetNotificationSettingsUseCase(
          new PrismaNotificationSettings(prisma),
          channels.map((c) => c.name),
        ),
      inject: [PrismaService, CHANNELS],
    },
    {
      provide: UpdateNotificationSettingUseCase,
      useFactory: (prisma: PrismaService, channels: NotificationChannel[]) =>
        new UpdateNotificationSettingUseCase(
          new PrismaNotificationSettings(prisma),
          channels.map((c): ChannelName => c.name),
        ),
      inject: [PrismaService, CHANNELS],
    },
    {
      provide: SendTestNotificationUseCase,
      useFactory: (prisma: PrismaService, channels: NotificationChannel[]) =>
        new SendTestNotificationUseCase(channels, new PrismaNotificationSettings(prisma)),
      inject: [PrismaService, CHANNELS],
    },
    {
      provide: NotifySaleUseCase,
      useFactory: (prisma: PrismaService, channels: NotificationChannel[], config: AppConfig) =>
        new NotifySaleUseCase(
          channels,
          new PrismaNotificationSettings(prisma),
          new PrismaNotificationLog(prisma),
          config.WEB_ORIGIN,
        ),
      inject: [PrismaService, CHANNELS, APP_CONFIG],
    },
    {
      provide: OutboxWorker,
      useFactory: (
        prisma: PrismaService,
        tx: TransactionalDb,
        notify: NotifySaleUseCase,
        config: AppConfig,
      ) =>
        new OutboxWorker(
          new ProcessOutboxUseCase(
            new PrismaOutboxQueue(prisma),
            new PrismaOrderRepository(tx),
            notify,
          ),
          config.OUTBOX_POLL_MS,
          config.WORKER_ENABLED,
        ),
      inject: [PrismaService, TX, NotifySaleUseCase, APP_CONFIG],
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
