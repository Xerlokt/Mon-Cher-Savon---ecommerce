import type { NotificationChannel, SaleNotification } from '../../domain/ports/index.js';

export class ChannelDeliveryFailure extends Error {
  constructor(
    channel: string,
    readonly status?: number,
  ) {
    // Never include URLs or tokens here: this message can reach logs.
    super(`Falha ao enviar pelo canal ${channel}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'ChannelDeliveryFailure';
  }
}

export interface TelegramConfig {
  botToken: string;
  baseUrl?: string;
}

export class TelegramChannel implements NotificationChannel {
  readonly name = 'telegram' as const;
  private readonly baseUrl: string;

  constructor(private readonly config: TelegramConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.telegram.org';
  }

  async send(message: SaleNotification, destination: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: destination,
          text: message.text,
          disable_web_page_preview: true,
        }),
      });
    } catch {
      throw new ChannelDeliveryFailure('telegram');
    }
    if (!res.ok) throw new ChannelDeliveryFailure('telegram', res.status);
  }
}
