import { describe, expect, it } from 'vitest';
import { signSessionToken, verifySessionToken } from './session.js';

const secret = 'a-long-random-secret';
const now = 1_760_000_000;

describe('session token', () => {
  it('round-trips a valid token', async () => {
    const token = await signSessionToken({ sub: 'admin-1', exp: now + 60 }, secret);
    expect(await verifySessionToken(token, secret, now)).toEqual({ sub: 'admin-1', exp: now + 60 });
  });

  it('rejects expired tokens', async () => {
    const token = await signSessionToken({ sub: 'admin-1', exp: now - 1 }, secret);
    expect(await verifySessionToken(token, secret, now)).toBeNull();
  });

  it('rejects a wrong secret and a tampered payload', async () => {
    const token = await signSessionToken({ sub: 'admin-1', exp: now + 60 }, secret);
    expect(await verifySessionToken(token, 'other-secret', now)).toBeNull();

    const forged = await signSessionToken({ sub: 'attacker', exp: now + 60 }, 'other-secret');
    const [forgedBody] = forged.split('.');
    const [, signature] = token.split('.');
    expect(await verifySessionToken(`${forgedBody}.${signature}`, secret, now)).toBeNull();
  });

  it('rejects missing, malformed or empty-secret input', async () => {
    expect(await verifySessionToken(undefined, secret, now)).toBeNull();
    expect(await verifySessionToken('abc', secret, now)).toBeNull();
    expect(await verifySessionToken('a.b.c', secret, now)).toBeNull();
    expect(await verifySessionToken('!!!.???', secret, now)).toBeNull();
    const token = await signSessionToken({ sub: 'x', exp: now + 60 }, secret);
    expect(await verifySessionToken(token, '', now)).toBeNull();
  });
});
