import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_COOKIE } from '@mon-cher-savon/contracts';
import type { AdminUserRepository, SessionTokens } from '../../domain/ports/index.js';

export const SESSION_TOKENS = 'SESSION_TOKENS';
export const ADMIN_USERS = 'ADMIN_USERS';
export const ALLOWED_ORIGIN = 'ALLOWED_ORIGIN';

export interface AdminRequest {
  method: string;
  headers: Record<string, string | undefined>;
  adminId?: string;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Requires a valid signed session cookie. For state-changing requests it also checks the
 * Origin header (CSRF defense in depth on top of SameSite cookies).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(SESSION_TOKENS) private readonly tokens: SessionTokens,
    @Inject(ADMIN_USERS) private readonly admins: AdminUserRepository,
    @Inject(ALLOWED_ORIGIN) private readonly allowedOrigin: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const session = await this.tokens.verify(readCookie(req.headers['cookie'], SESSION_COOKIE));
    if (!session) throw new UnauthorizedException('Faça login para continuar.');
    const admin = await this.admins.findById(session.adminId);
    if (!admin) throw new UnauthorizedException('Faça login para continuar.');

    if (!SAFE_METHODS.has(req.method.toUpperCase())) {
      const origin = req.headers['origin'];
      if (origin && origin !== this.allowedOrigin) {
        throw new ForbiddenException('Origem não permitida.');
      }
    }
    req.adminId = admin.id;
    return true;
  }
}
