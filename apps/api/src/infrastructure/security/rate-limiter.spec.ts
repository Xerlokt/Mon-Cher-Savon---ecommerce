import 'reflect-metadata';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RateLimiter, rateLimitGuard } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('allows up to the limit per window and then tells how long to wait', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 60_000, () => now);
    expect(limiter.consume('a')).toBe(0);
    expect(limiter.consume('a')).toBe(0);
    expect(limiter.consume('a')).toBe(60);
    now = 30_000;
    expect(limiter.consume('a')).toBe(30);
    now = 60_000;
    expect(limiter.consume('a')).toBe(0);
  });

  it('keeps clients independent', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.consume('a')).toBe(0);
    expect(limiter.consume('b')).toBe(0);
    expect(limiter.consume('a')).toBeGreaterThan(0);
  });

  it('sweeps expired entries when the table grows', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 10, () => now);
    for (let i = 0; i < 10_001; i++) limiter.consume(`k${i}`);
    now = 1000;
    expect(limiter.consume('fresh')).toBe(0);
    expect(limiter.consume('k0')).toBe(0);
  });
});

const Guard = rateLimitGuard('test', 2, 60_000);

@Controller('limited')
@UseGuards(Guard)
class LimitedController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe('rateLimitGuard', () => {
  it('answers 429 with a friendly message after the limit', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LimitedController],
      providers: [Guard],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const server = app.getHttpServer();
    await request(server).get('/limited').expect(200);
    await request(server).get('/limited').expect(200);
    const blocked = await request(server).get('/limited').expect(429);
    expect(blocked.body.message).toContain('Aguarde');
    await app.close();
  });
});
