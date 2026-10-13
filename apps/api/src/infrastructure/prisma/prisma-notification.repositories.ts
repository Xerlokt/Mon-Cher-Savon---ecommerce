import type { PrismaClient } from '@prisma/client';
import type {
  ChannelName,
  NotificationLogRepository,
  NotificationSetting,
  NotificationSettingsRepository,
  OutboxEntry,
  OutboxQueue,
} from '../../domain/ports/index.js';

const CHANNELS: ChannelName[] = ['telegram', 'whatsapp'];

export class PrismaNotificationSettings implements NotificationSettingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async all(): Promise<NotificationSetting[]> {
    const rows = await this.db.notificationSetting.findMany();
    return CHANNELS.map((channel) => {
      const row = rows.find((r) => r.channel === channel);
      return { channel, enabled: row?.enabled ?? false, destination: row?.destination ?? '' };
    });
  }

  async enabledTargets() {
    return (await this.all())
      .filter((s) => s.enabled && s.destination)
      .map(({ channel, destination }) => ({ channel, destination }));
  }

  async save(setting: NotificationSetting): Promise<void> {
    await this.db.notificationSetting.upsert({
      where: { channel: setting.channel },
      update: { enabled: setting.enabled, destination: setting.destination },
      create: setting,
    });
  }
}

export class PrismaNotificationLog implements NotificationLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async record(
    orderId: string,
    channels: string[],
    results: PromiseSettledResult<void>[],
  ): Promise<void> {
    if (channels.length === 0) return;
    await this.db.notificationLog.createMany({
      data: channels.map((channel, i) => ({
        orderId,
        channel,
        success: results[i]?.status === 'fulfilled',
      })),
    });
  }
}

export class PrismaOutboxQueue implements OutboxQueue {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Atomically leases due events (FOR UPDATE SKIP LOCKED) by pushing nextAttemptAt forward,
   * so concurrent workers never pick the same event and a crashed worker is retried later.
   */
  async claimDue(limit: number, now: Date, leaseMs: number): Promise<OutboxEntry[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const rows = await this.db.$queryRaw<
      Array<{ id: string; type: string; payload: Record<string, unknown>; attempts: number }>
    >`
      UPDATE "OutboxEvent" SET "nextAttemptAt" = ${leaseUntil}
      WHERE id IN (
        SELECT id FROM "OutboxEvent"
        WHERE status = 'PENDING' AND "nextAttemptAt" <= ${now}
        ORDER BY "createdAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, type, payload, attempts`;
    return rows;
  }

  async markSent(id: string): Promise<void> {
    await this.db.outboxEvent.update({ where: { id }, data: { status: 'SENT' } });
  }

  async markRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void> {
    await this.db.outboxEvent.update({
      where: { id },
      data: { status: 'PENDING', attempts, nextAttemptAt },
    });
  }

  async markFailed(id: string, attempts: number): Promise<void> {
    await this.db.outboxEvent.update({ where: { id }, data: { status: 'FAILED', attempts } });
  }
}
