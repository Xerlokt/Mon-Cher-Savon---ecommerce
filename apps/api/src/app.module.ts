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
import { AdminAuthController, COOKIE_SECURE } from './presentation/http/admin-auth.controller.js';
import {
  ADMIN_ORDER_QUERY,
  ADMIN_PRODUCT_REPOSITORY,
  AdminCatalogSupportController,
  AdminOrdersController,
  AdminProductsController,
  IMAGE_STORAGE,
} from './presentation/http/admin-sales-products.controllers.js';
import {
  ADMIN_USERS,
  ALLOWED_ORIGIN,
  AdminGuard,
  SESSION_TOKENS,
} from './presentation/http/admin.guard.js';
import { GetDashboardUseCase } from './application/dashboard.use-case.js';
import { PrismaDashboardQuery } from './infrastructure/prisma/prisma-dashboard.query.js';
import { DashboardController } from './presentation/http/dashboard.controller.js';
import { LoginUseCase } from './application/admin-auth.use-cases.js';
import { ChangeOrderStatusUseCase } from './application/admin-orders.use-cases.js';
import {
  AdjustStockUseCase,
  ArchiveProductUseCase,
  CreateIngredientUseCase,
  CreateProductUseCase,
  RestoreProductUseCase,
  UpdateProductUseCase,
} from './application/admin-products.use-cases.js';
import {
  Argon2idHasher,
  HmacSessionTokens,
  InMemoryLoginThrottle,
} from './infrastructure/security/security.js';
import { CloudinaryImageStorage } from './infrastructure/storage/cloudinary-image-storage.js';
import { LocalDiskImageStorage } from './infrastructure/storage/local-image-storage.js';
import {
  PrismaAdminOrderQuery,
  PrismaAdminProductRepository,
  PrismaAdminUsers,
} from './infrastructure/prisma/prisma-admin.repositories.js';
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
    AdminAuthController,
    AdminOrdersController,
    AdminProductsController,
    AdminCatalogSupportController,
    DashboardController,
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
    { provide: ALLOWED_ORIGIN, useFactory: (c: AppConfig) => c.WEB_ORIGIN, inject: [APP_CONFIG] },
    { provide: COOKIE_SECURE, useFactory: (c: AppConfig) => c.COOKIE_SECURE, inject: [APP_CONFIG] },
    {
      provide: SESSION_TOKENS,
      useFactory: (c: AppConfig) => new HmacSessionTokens(c.SESSION_SECRET),
      inject: [APP_CONFIG],
    },
    {
      provide: ADMIN_USERS,
      useFactory: (prisma: PrismaService) => new PrismaAdminUsers(prisma),
      inject: [PrismaService],
    },
    {
      provide: LoginUseCase,
      useFactory: async (prisma: PrismaService) => {
        const hasher = new Argon2idHasher();
        // Hash of a random password: verified when the email is unknown to keep timing uniform.
        const decoy = await hasher.hash(`decoy-${Math.random()}`);
        return new LoginUseCase(
          new PrismaAdminUsers(prisma),
          hasher,
          new HmacSessionTokens(loadConfig().SESSION_SECRET),
          new InMemoryLoginThrottle(),
          decoy,
        );
      },
      inject: [PrismaService],
    },
    {
      provide: GetDashboardUseCase,
      useFactory: (prisma: PrismaService) =>
        new GetDashboardUseCase(new PrismaDashboardQuery(prisma)),
      inject: [PrismaService],
    },
    {
      provide: ADMIN_ORDER_QUERY,
      useFactory: (prisma: PrismaService) => new PrismaAdminOrderQuery(prisma),
      inject: [PrismaService],
    },
    {
      provide: ADMIN_PRODUCT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaAdminProductRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: IMAGE_STORAGE,
      useFactory: (c: AppConfig) =>
        c.IMAGE_STORAGE === 'cloudinary'
          ? new CloudinaryImageStorage({
              cloudName: c.CLOUDINARY_CLOUD_NAME ?? '',
              apiKey: c.CLOUDINARY_API_KEY ?? '',
              apiSecret: c.CLOUDINARY_API_SECRET ?? '',
              folder: c.CLOUDINARY_FOLDER,
            })
          : new LocalDiskImageStorage(c.UPLOAD_DIR),
      inject: [APP_CONFIG],
    },
    {
      provide: ChangeOrderStatusUseCase,
      useFactory: (tx: TransactionalDb) => {
        const products = new PrismaProductRepository(tx);
        return new ChangeOrderStatusUseCase(
          new PrismaOrderRepository(tx),
          products,
          products,
          new PrismaStockMovements(tx),
          tx,
        );
      },
      inject: [TX],
    },
    {
      provide: CreateProductUseCase,
      useFactory: (prisma: PrismaService, tx: TransactionalDb) =>
        new CreateProductUseCase(
          new PrismaAdminProductRepository(prisma),
          new PrismaStockMovements(tx),
        ),
      inject: [PrismaService, TX],
    },
    {
      provide: UpdateProductUseCase,
      useFactory: (prisma: PrismaService) =>
        new UpdateProductUseCase(new PrismaAdminProductRepository(prisma)),
      inject: [PrismaService],
    },
    {
      provide: ArchiveProductUseCase,
      useFactory: (prisma: PrismaService) =>
        new ArchiveProductUseCase(new PrismaAdminProductRepository(prisma)),
      inject: [PrismaService],
    },
    {
      provide: RestoreProductUseCase,
      useFactory: (prisma: PrismaService) =>
        new RestoreProductUseCase(new PrismaAdminProductRepository(prisma)),
      inject: [PrismaService],
    },
    {
      provide: CreateIngredientUseCase,
      useFactory: (prisma: PrismaService) =>
        new CreateIngredientUseCase(new PrismaAdminProductRepository(prisma)),
      inject: [PrismaService],
    },
    {
      provide: AdjustStockUseCase,
      useFactory: (tx: TransactionalDb) => {
        const products = new PrismaProductRepository(tx);
        return new AdjustStockUseCase(products, products, new PrismaStockMovements(tx), tx);
      },
      inject: [TX],
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
              ...(config.MERCADOPAGO_API_BASE_URL
                ? { baseUrl: config.MERCADOPAGO_API_BASE_URL }
                : {}),
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
