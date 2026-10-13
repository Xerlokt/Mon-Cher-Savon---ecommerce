import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

export const ADMIN_BOOTSTRAP_TOKEN = 'ADMIN_BOOTSTRAP_TOKEN';

/**
 * Temporary admin protection: a static bearer token from the environment.
 * Replaced by the seller login session in stage 5. With no token configured, admin routes are closed.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(ADMIN_BOOTSTRAP_TOKEN) private readonly token: string) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) throw new ForbiddenException('Área administrativa desativada');
    const header = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>().headers['authorization'];
    const provided = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(this.token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
