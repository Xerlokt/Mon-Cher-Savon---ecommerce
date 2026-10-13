import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GetNotificationSettingsUseCase,
  SendTestNotificationUseCase,
  UpdateNotificationSettingUseCase,
} from '../../application/notification-settings.use-cases.js';
import { FakeChannel, FakeNotificationSettings } from '../../application/testing/fakes.js';
import { NotificationsController } from './notifications.controller.js';
import { ORIGIN, SESSION_COOKIE_HEADER, createAdminTestApp } from './testing/admin-test-app.js';

let settings: FakeNotificationSettings;
let telegram: FakeChannel;
let app: INestApplication;

const auth = { Cookie: SESSION_COOKIE_HEADER, Origin: ORIGIN };

async function createApp(): Promise<INestApplication> {
  return createAdminTestApp(
    [NotificationsController],
    [
      {
        provide: GetNotificationSettingsUseCase,
        useValue: new GetNotificationSettingsUseCase(settings, ['telegram']),
      },
      {
        provide: UpdateNotificationSettingUseCase,
        useValue: new UpdateNotificationSettingUseCase(settings, ['telegram']),
      },
      {
        provide: SendTestNotificationUseCase,
        useValue: new SendTestNotificationUseCase([telegram], settings),
      },
    ],
  );
}

beforeEach(() => {
  settings = new FakeNotificationSettings();
  telegram = new FakeChannel('telegram');
});

afterEach(async () => {
  await app?.close();
});

describe('admin notifications', () => {
  it('requires a seller session', async () => {
    app = await createApp();
    await request(app.getHttpServer()).get('/api/v1/admin/notifications/settings').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/notifications/test')
      .send({ channel: 'telegram' })
      .expect(401);
  });

  it('lists, updates and tests a channel', async () => {
    app = await createApp();
    const server = app.getHttpServer();

    const list = await request(server)
      .get('/api/v1/admin/notifications/settings')
      .set(auth)
      .expect(200);
    expect(
      list.body.map((s: { channel: string; available: boolean }) => [s.channel, s.available]),
    ).toEqual([
      ['telegram', true],
      ['whatsapp', false],
    ]);

    await request(server)
      .put('/api/v1/admin/notifications/settings')
      .set(auth)
      .send({ channel: 'telegram', enabled: true, destination: '123456789' })
      .expect(200);

    await request(server)
      .post('/api/v1/admin/notifications/test')
      .set(auth)
      .send({ channel: 'telegram' })
      .expect(200);
    expect(telegram.sent[0]?.destination).toBe('123456789');
  });

  it('validates input and explains business errors', async () => {
    settings = new FakeNotificationSettings([], { telegram: '' });
    app = await createApp();
    const server = app.getHttpServer();
    await request(server)
      .put('/api/v1/admin/notifications/settings')
      .set(auth)
      .send({ channel: 'sms', enabled: true })
      .expect(400);
    const res = await request(server)
      .put('/api/v1/admin/notifications/settings')
      .set(auth)
      .send({ channel: 'telegram', enabled: true, destination: 'abc' })
      .expect(422);
    expect(res.body.message).toContain('Telegram');
    await request(server)
      .post('/api/v1/admin/notifications/test')
      .set(auth)
      .send({ channel: 'telegram' })
      .expect(422);
  });
});
