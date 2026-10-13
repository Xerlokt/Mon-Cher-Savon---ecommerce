import * as argon2 from 'argon2';
import { signSessionToken, verifySessionToken } from '@mon-cher-savon/contracts';
import type { LoginThrottle, PasswordHasher, SessionTokens } from '../../domain/ports/index.js';

export class Argon2idHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash) {
      // Burn comparable time so unknown emails are indistinguishable from wrong passwords.
      await argon2.hash(plain, { type: argon2.argon2id });
      return false;
    }
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}

export const REMEMBER_SECONDS = 30 * 24 * 3600;
export const SESSION_SECONDS = 12 * 3600;

export class HmacSessionTokens implements SessionTokens {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  async issue(adminId: string, remember: boolean) {
    const ttl = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
    const token = await signSessionToken({ sub: adminId, exp: this.now() + ttl }, this.secret);
    // Without "remember" the cookie has no Max-Age: it disappears when the browser closes.
    return { token, maxAgeSeconds: remember ? ttl : null };
  }

  async verify(token: string | undefined) {
    const payload = await verifySessionToken(token, this.secret, this.now());
    return payload ? { adminId: payload.sub } : null;
  }
}

/** In-memory brute-force protection. For several API instances use a shared store instead. */
export class InMemoryLoginThrottle implements LoginThrottle {
  private readonly entries = new Map<string, { failures: number; lastFailureAt: number }>();

  constructor(
    private readonly maxFailures = 5,
    private readonly lockMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  retryAfterSeconds(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    const elapsed = this.now() - entry.lastFailureAt;
    if (elapsed >= this.lockMs) {
      this.entries.delete(key);
      return 0;
    }
    return entry.failures >= this.maxFailures ? Math.ceil((this.lockMs - elapsed) / 1000) : 0;
  }

  recordFailure(key: string): void {
    const current = this.entries.get(key);
    const stale = current && this.now() - current.lastFailureAt >= this.lockMs;
    this.entries.set(key, {
      failures: current && !stale ? current.failures + 1 : 1,
      lastFailureAt: this.now(),
    });
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}
