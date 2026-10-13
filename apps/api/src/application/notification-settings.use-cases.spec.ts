import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain/shared/domain-error.js';
import {
  GetNotificationSettingsUseCase,
  NotificationDeliveryError,
  SendTestNotificationUseCase,
  UpdateNotificationSettingUseCase,
} from './notification-settings.use-cases.js';
import { FakeChannel, FakeNotificationSettings } from './testing/fakes.js';

describe('UpdateNotificationSettingUseCase', () => {
  it('saves a valid Telegram destination', async () => {
    const settings = new FakeNotificationSettings();
    await new UpdateNotificationSettingUseCase(settings, ['telegram']).execute({
      channel: 'telegram',
      enabled: true,
      destination: ' 123456789 ',
    });
    expect(settings.settings.find((s) => s.channel === 'telegram')).toEqual({
      channel: 'telegram',
      enabled: true,
      destination: '123456789',
    });
  });

  it('accepts negative Telegram chat ids (groups) and normalizes WhatsApp numbers', async () => {
    const settings = new FakeNotificationSettings();
    const useCase = new UpdateNotificationSettingUseCase(settings, ['telegram', 'whatsapp']);
    await useCase.execute({ channel: 'telegram', enabled: true, destination: '-1001234567' });
    await useCase.execute({
      channel: 'whatsapp',
      enabled: true,
      destination: '+55 (11) 91234-5678',
    });
    expect(settings.settings.find((s) => s.channel === 'whatsapp')?.destination).toBe(
      '5511912345678',
    );
  });

  it('rejects enabling without a valid destination', async () => {
    const useCase = new UpdateNotificationSettingUseCase(new FakeNotificationSettings(), [
      'telegram',
      'whatsapp',
    ]);
    await expect(
      useCase.execute({ channel: 'telegram', enabled: true, destination: 'abc' }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      useCase.execute({ channel: 'whatsapp', enabled: true, destination: '123' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('allows disabling a channel without a destination', async () => {
    const settings = new FakeNotificationSettings(['telegram']);
    await new UpdateNotificationSettingUseCase(settings, ['telegram']).execute({
      channel: 'telegram',
      enabled: false,
      destination: '',
    });
    expect(settings.settings.find((s) => s.channel === 'telegram')?.enabled).toBe(false);
  });

  it('refuses to enable a channel that is not configured on the server', async () => {
    const useCase = new UpdateNotificationSettingUseCase(new FakeNotificationSettings(), []);
    await expect(
      useCase.execute({ channel: 'telegram', enabled: true, destination: '123456' }),
    ).rejects.toThrow(/não está configurado/);
  });
});

describe('GetNotificationSettingsUseCase', () => {
  it('reports which channels the server can use', async () => {
    const result = await new GetNotificationSettingsUseCase(
      new FakeNotificationSettings(['telegram'], { telegram: '123456' }),
      ['telegram'],
    ).execute();
    expect(result).toEqual([
      { channel: 'telegram', enabled: true, destination: '123456', available: true },
      { channel: 'whatsapp', enabled: false, destination: 'dest-whatsapp', available: false },
    ]);
  });
});

describe('SendTestNotificationUseCase', () => {
  it('sends a test message to the saved destination', async () => {
    const telegram = new FakeChannel('telegram');
    await new SendTestNotificationUseCase(
      [telegram],
      new FakeNotificationSettings([], { telegram: '123456' }),
    ).execute('telegram');
    expect(telegram.sent).toHaveLength(1);
    expect(telegram.sent[0]?.destination).toBe('123456');
    expect(telegram.sent[0]?.text).toContain('teste');
  });

  it('requires a saved destination and a configured channel', async () => {
    await expect(
      new SendTestNotificationUseCase(
        [new FakeChannel('telegram')],
        new FakeNotificationSettings([], { telegram: '' }),
      ).execute('telegram'),
    ).rejects.toThrow(/destino/);
    await expect(
      new SendTestNotificationUseCase([], new FakeNotificationSettings()).execute('telegram'),
    ).rejects.toThrow(/não está configurado/);
  });

  it('hides provider details behind a friendly delivery error', async () => {
    await expect(
      new SendTestNotificationUseCase(
        [new FakeChannel('telegram', true)],
        new FakeNotificationSettings([], { telegram: '123456' }),
      ).execute('telegram'),
    ).rejects.toBeInstanceOf(NotificationDeliveryError);
  });
});
