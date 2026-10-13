import { describe, expect, it } from 'vitest';
import {
  Argon2idHasher,
  HmacSessionTokens,
  InMemoryLoginThrottle,
  REMEMBER_SECONDS,
  SESSION_SECONDS,
} from './security.js';

describe('Argon2idHasher', () => {
  const hasher = new Argon2idHasher();

  it('hashes with argon2id and verifies', async () => {
    const hash = await hasher.hash('senha-bem-forte');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verify(hash, 'senha-bem-forte')).toBe(true);
    expect(await hasher.verify(hash, 'outra')).toBe(false);
  });

  it('returns false for empty or malformed hashes instead of throwing', async () => {
    expect(await hasher.verify('', 'x')).toBe(false);
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
  });
});

describe('HmacSessionTokens', () => {
  const secret = 'x'.repeat(40);

  it('issues short sessions as browser-session cookies and long ones with max age', async () => {
    const tokens = new HmacSessionTokens(secret, () => 1000);
    expect((await tokens.issue('a1', false)).maxAgeSeconds).toBeNull();
    expect((await tokens.issue('a1', true)).maxAgeSeconds).toBe(REMEMBER_SECONDS);
  });

  it('verifies until expiry and rejects other secrets', async () => {
    let now = 1000;
    const tokens = new HmacSessionTokens(secret, () => now);
    const { token } = await tokens.issue('a1', false);
    expect(await tokens.verify(token)).toEqual({ adminId: 'a1' });
    now += SESSION_SECONDS + 1;
    expect(await tokens.verify(token)).toBeNull();
    expect(await new HmacSessionTokens('y'.repeat(40), () => 1000).verify(token)).toBeNull();
    expect(await tokens.verify(undefined)).toBeNull();
  });
});

describe('InMemoryLoginThrottle', () => {
  it('locks after max failures and unlocks after the lock time', () => {
    let now = 0;
    const throttle = new InMemoryLoginThrottle(3, 60_000, () => now);
    for (let i = 0; i < 2; i++) throttle.recordFailure('k');
    expect(throttle.retryAfterSeconds('k')).toBe(0);
    throttle.recordFailure('k');
    expect(throttle.retryAfterSeconds('k')).toBe(60);
    now = 30_000;
    expect(throttle.retryAfterSeconds('k')).toBe(30);
    now = 60_000;
    expect(throttle.retryAfterSeconds('k')).toBe(0);
  });

  it('forgets old failures and supports reset', () => {
    let now = 0;
    const throttle = new InMemoryLoginThrottle(2, 60_000, () => now);
    throttle.recordFailure('k');
    now = 120_000;
    throttle.recordFailure('k');
    expect(throttle.retryAfterSeconds('k')).toBe(0);
    throttle.recordFailure('k');
    expect(throttle.retryAfterSeconds('k')).toBeGreaterThan(0);
    throttle.reset('k');
    expect(throttle.retryAfterSeconds('k')).toBe(0);
  });

  it('keeps keys independent', () => {
    const throttle = new InMemoryLoginThrottle(1);
    throttle.recordFailure('a');
    expect(throttle.retryAfterSeconds('a')).toBeGreaterThan(0);
    expect(throttle.retryAfterSeconds('b')).toBe(0);
  });
});
