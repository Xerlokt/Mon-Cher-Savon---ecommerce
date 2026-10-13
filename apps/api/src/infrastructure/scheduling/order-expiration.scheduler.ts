import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ExpireOrdersUseCase } from '../../application/expire-orders.use-case.js';

export class OrderExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpirationScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly expireOrders: ExpireOrdersUseCase,
    private readonly everyMs = 60_000,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.everyMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    try {
      const cancelled = await this.expireOrders.execute();
      if (cancelled > 0) this.logger.log(`${cancelled} pedido(s) expirado(s) cancelado(s)`);
    } catch (error) {
      this.logger.error(`Falha ao expirar pedidos: ${(error as Error).message}`);
    }
  }
}
