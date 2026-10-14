import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { GetDashboardUseCase } from '../../application/dashboard.use-case.js';
import type { DashboardQuery } from '../../domain/ports/index.js';
import { DashboardController } from './dashboard.controller.js';
import { ORIGIN, SESSION_COOKIE_HEADER, createAdminTestApp } from './testing/admin-test-app.js';

const periods: Date[] = [];
const query: DashboardQuery = {
  async aggregate(from) {
    periods.push(from);
    return {
      byDay: [{ day: '2026-03-18', salesCount: 1, revenueCents: 4600 }],
      topProducts: [],
      topIngredients: [],
      lowStock: [],
    };
  },
};

let app: INestApplication;
const auth = { Cookie: SESSION_COOKIE_HEADER, Origin: ORIGIN };

const create = async () => {
  app = await createAdminTestApp(
    [DashboardController],
    [
      {
        provide: GetDashboardUseCase,
        useValue: new GetDashboardUseCase(query, () => new Date('2026-03-18T17:00:00Z')),
      },
    ],
  );
  return app.getHttpServer();
};

afterEach(async () => {
  await app?.close();
});

describe('GET /admin/dashboard', () => {
  it('requires a seller session', async () => {
    await request(await create())
      .get('/api/v1/admin/dashboard')
      .expect(401);
  });

  it('defaults to today and returns the metrics', async () => {
    const res = await request(await create())
      .get('/api/v1/admin/dashboard')
      .set(auth)
      .expect(200);
    expect(res.body).toMatchObject({
      period: 'hoje',
      salesCount: 1,
      revenueCents: 4600,
      averageTicketCents: 4600,
    });
  });

  it('accepts the 7-day and month presets', async () => {
    const server = await create();
    const week = await request(server)
      .get('/api/v1/admin/dashboard?period=7dias')
      .set(auth)
      .expect(200);
    expect(week.body.salesByDay).toHaveLength(7);
    const month = await request(server)
      .get('/api/v1/admin/dashboard?period=mes')
      .set(auth)
      .expect(200);
    expect(month.body.salesByDay).toHaveLength(18);
  });

  it('answers a custom date range', async () => {
    const res = await request(await create())
      .get('/api/v1/admin/dashboard?period=personalizado&from=2026-03-10&to=2026-03-18')
      .set(auth)
      .expect(200);
    expect(res.body).toMatchObject({
      period: 'personalizado',
      from: '2026-03-10',
      to: '2026-03-18',
    });
    expect(res.body.salesByDay).toHaveLength(9);
  });

  it.each([
    'period=personalizado',
    'period=personalizado&from=2026-03-18&to=2026-03-10',
    'period=personalizado&from=2024-01-01&to=2026-03-10',
    'period=personalizado&from=abc&to=2026-03-10',
  ])('rejects an invalid custom range (%s)', async (qs) => {
    await request(await create())
      .get(`/api/v1/admin/dashboard?${qs}`)
      .set(auth)
      .expect(400);
  });

  it('rejects unknown periods', async () => {
    await request(await create())
      .get('/api/v1/admin/dashboard?period=ano')
      .set(auth)
      .expect(400);
  });
});
