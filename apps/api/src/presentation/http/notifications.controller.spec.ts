import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  GetNotificationSettingsUseCase,
  SendTestNotificationUseCase,
  UpdateNotificationSettingUseCase,
} from '../../application/notification-settings.use-cases.js';
import { FakeChannel, FakeNotificationSettings } from '../../application/testing/fakes.js';
import { ADMIN_BOOTSTRAP_TOKEN, AdminGuard } from './admin.guard.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';
import { NotificationsController } from './notifications.controller.js';

const TOKEN = 'admin-secret-token';
let settings: FakeNotificationSettings;
let telegram: FakeChannel;

async function createApp(token: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      AdminGuard,
      { provide: ADMIN_BOOTSTRAP_TOKEN, useValue: token },
      {
        provide: GetNotificationSettingsUseCase,
        useFactory: () => new GetNotificationSettingsUseCase(settings, ['telegram']),
      },
      {
        provide: UpdateNotificationSettingUseCase,
        useFactory: () => new UpdateNotificationSettingUseCase(settings, ['telegram']),
      },
      {
        provide: SendTestNotificationUseCase,
        useFactory: () => new SendTestNotificationUseCase([telegram], settings),
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.init();
  return app;
}

let app: INestApplication;
const auth = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  settings = new FakeNotificationSettings();
  telegram = new FakeChannel('telegram');
});

afterAll(async () => {
  await app?.close();
});

describe('admin notifications', () => {
  it('rejects requests without or with the wrong token', async () => {
    app = await createApp(TOKEN);
    await request(app.getHttpServer()).get('/api/v1/admin/notifications/settings').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/settings')
      .set({ Authorization: 'Bearer nope' })
      .expect(401);
    await app.close();
  });

  it('is closed entirely when no admin token is configured', async () => {
    app = await createApp('');
    await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/settings')
      .set(auth)
      .expect(403);
    await app.close();
  });

  it('lists, updates and tests a channel', async () => {
    app = await createApp(TOKEN);
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
    await app.close();
  });

  it('validates input and explains business errors', async () => {
    settings = new FakeNotificationSettings([], { telegram: '' });
    app = await createApp(TOKEN);
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
    await app.close();
  });
});
