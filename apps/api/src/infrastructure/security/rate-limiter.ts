import { type CanActivate, type ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

/** Fixed-window counter per key, in memory (single instance). */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns 0 when allowed, otherwise the seconds to wait. */
  consume(key: string): number {
    const now = this.now();
    if (this.hits.size > 10_000) this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }
    if (entry.count >= this.limit) return Math.ceil((entry.resetAt - now) / 1000);
    entry.count++;
    return 0;
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

/** Builds a guard class limiting each client IP to `limit` requests per window on a route. */
export function rateLimitGuard(name: string, limit: number, windowMs: number) {
  const limiter = new RateLimiter(limit, windowMs);
  class RateLimitGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<{ ip?: string }>();
      const wait = limiter.consume(`${name}|${req.ip ?? 'unknown'}`);
      if (wait > 0) {
        throw new HttpException(
          { statusCode: 429, message: 'Muitas tentativas. Aguarde um instante e tente de novo.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    }
  }
  // Nest resolves guards by class name: anonymous classes would be skipped silently.
  Object.defineProperty(RateLimitGuard, 'name', { value: `RateLimitGuard_${name}` });
  return RateLimitGuard;
}
