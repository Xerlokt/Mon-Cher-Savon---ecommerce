import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from './bootstrap.js';
import { loadConfig } from './config.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class TestModule {}

let app: NestExpressApplication;

beforeAll(async () => {
  app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
  configureApp(
    app,
    loadConfig({
      PAYMENT_MODE: 'fake',
      SESSION_SECRET: 'x'.repeat(40),
      WEB_ORIGIN: 'https://loja.test',
      UPLOAD_DIR: './uploads-test',
    }),
  );
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('configureApp', () => {
  it('prefixes routes and sends the standard security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('only allows the store origin through CORS', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', 'https://loja.test');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://loja.test');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', 'https://evil.test');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.test');
  });

  it('serves the Swagger docs with a relaxed CSP only on /api/docs', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs').expect(200);
    expect(docs.headers['content-security-policy']).toContain("'unsafe-inline'");
    const api = await request(app.getHttpServer()).get('/api/v1/ping');
    expect(api.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });
});
