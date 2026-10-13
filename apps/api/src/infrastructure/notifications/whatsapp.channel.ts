import type { NotificationChannel, SaleNotification } from '../../domain/ports/index.js';
import { ChannelDeliveryFailure } from './telegram.channel.js';

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Name of the approved message template with a single body variable {{1}}. */
  templateName: string;
  languageCode?: string;
  baseUrl?: string;
}

/** Template variables cannot contain line breaks, tabs or long runs of spaces. */
export function toTemplateVariable(text: string): string {
  return text
    .replace(/[\t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' | ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 1024);
}

/** Official WhatsApp Cloud API (Meta). Business-initiated messages must use an approved template. */
export class WhatsAppChannel implements NotificationChannel {
  readonly name = 'whatsapp' as const;
  private readonly baseUrl: string;

  constructor(private readonly config: WhatsAppConfig) {
    this.baseUrl = config.baseUrl ?? 'https://graph.facebook.com/v21.0';
  }

  async send(message: SaleNotification, destination: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: destination,
          type: 'template',
          template: {
            name: this.config.templateName,
            language: { code: this.config.languageCode ?? 'pt_BR' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: toTemplateVariable(message.text) }],
              },
            ],
          },
        }),
      });
    } catch {
      throw new ChannelDeliveryFailure('whatsapp');
    }
    if (!res.ok) throw new ChannelDeliveryFailure('whatsapp', res.status);
  }
}
