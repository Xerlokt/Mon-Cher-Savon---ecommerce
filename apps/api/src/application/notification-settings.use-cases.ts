import { DomainError } from '../domain/shared/domain-error.js';
import type {
  ChannelName,
  NotificationChannel,
  NotificationSetting,
  NotificationSettingsRepository,
} from '../domain/ports/index.js';

export class NotificationDeliveryError extends DomainError {
  constructor() {
    super('Não consegui enviar a mensagem. Confira o destino e toque em Tentar de novo.');
  }
}

const CHANNEL_LABEL: Record<ChannelName, string> = { telegram: 'Telegram', whatsapp: 'WhatsApp' };

function normalizeDestination(channel: ChannelName, raw: string): string | null {
  const value = raw.trim();
  if (channel === 'telegram') {
    return /^-?\d{5,20}$/.test(value) || /^@[A-Za-z0-9_]{5,32}$/.test(value) ? value : null;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export class UpdateNotificationSettingUseCase {
  constructor(
    private readonly settings: NotificationSettingsRepository,
    private readonly availableChannels: ChannelName[],
  ) {}

  async execute(input: NotificationSetting): Promise<NotificationSetting> {
    if (!input.enabled) {
      const destination = normalizeDestination(input.channel, input.destination) ?? '';
      const saved = { channel: input.channel, enabled: false, destination };
      await this.settings.save(saved);
      return saved;
    }
    if (!this.availableChannels.includes(input.channel)) {
      throw new DomainError(
        `O canal ${CHANNEL_LABEL[input.channel]} não está configurado no servidor.`,
      );
    }
    const destination = normalizeDestination(input.channel, input.destination);
    if (!destination) {
      throw new DomainError(
        input.channel === 'telegram'
          ? 'Informe o número do seu chat do Telegram (só números).'
          : 'Informe o número do WhatsApp com DDD, por exemplo 11 91234-5678.',
      );
    }
    const saved = { channel: input.channel, enabled: true, destination };
    await this.settings.save(saved);
    return saved;
  }
}

export class GetNotificationSettingsUseCase {
  constructor(
    private readonly settings: NotificationSettingsRepository,
    private readonly availableChannels: ChannelName[],
  ) {}

  async execute() {
    const all = await this.settings.all();
    return all.map((s) => ({ ...s, available: this.availableChannels.includes(s.channel) }));
  }
}

export class SendTestNotificationUseCase {
  constructor(
    private readonly channels: NotificationChannel[],
    private readonly settings: NotificationSettingsRepository,
  ) {}

  async execute(channel: ChannelName): Promise<void> {
    const impl = this.channels.find((c) => c.name === channel);
    if (!impl) {
      throw new DomainError(`O canal ${CHANNEL_LABEL[channel]} não está configurado no servidor.`);
    }
    const setting = (await this.settings.all()).find((s) => s.channel === channel);
    if (!setting?.destination) {
      throw new DomainError('Informe e salve o destino antes de enviar o teste.');
    }
    try {
      await impl.send(
        {
          text: 'Mensagem de teste da Mon Cher Savon. Se você leu isto, os avisos de venda estão funcionando!',
        },
        setting.destination,
      );
    } catch {
      throw new NotificationDeliveryError();
    }
  }
}
