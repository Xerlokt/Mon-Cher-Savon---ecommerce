import { describe, expect, it } from 'vitest';
import { testNotificationSchema, updateNotificationSettingSchema } from './notifications.js';

describe('notification contracts', () => {
  it('accepts a setting and defaults the destination', () => {
    expect(
      updateNotificationSettingSchema.parse({ channel: 'telegram', enabled: false }).destination,
    ).toBe('');
  });

  it('rejects unknown channels and non boolean flags', () => {
    expect(
      updateNotificationSettingSchema.safeParse({ channel: 'sms', enabled: true }).success,
    ).toBe(false);
    expect(
      updateNotificationSettingSchema.safeParse({ channel: 'telegram', enabled: 'yes' }).success,
    ).toBe(false);
    expect(testNotificationSchema.safeParse({ channel: 'email' }).success).toBe(false);
    expect(testNotificationSchema.safeParse({ channel: 'whatsapp' }).success).toBe(true);
  });
});
