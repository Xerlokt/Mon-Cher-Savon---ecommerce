import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ProcessOutboxUseCase } from '../../application/process-outbox.use-case.js';

/** Polls the Postgres outbox. Runs inside the API process; can be moved to its own process later. */
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly processOutbox: ProcessOutboxUseCase,
    private readonly everyMs: number,
    private readonly enabled: boolean,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.tick(), this.everyMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { sent, retried, failed } = await this.processOutbox.execute();
      if (sent + retried + failed > 0) {
        this.logger.log(`avisos: ${sent} enviados, ${retried} para repetir, ${failed} falharam`);
      }
    } catch (error) {
      this.logger.error(`Falha no worker de avisos: ${(error as Error).name}`);
    } finally {
      this.running = false;
    }
  }
}
