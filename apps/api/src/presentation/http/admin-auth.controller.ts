import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SESSION_COOKIE, loginSchema } from '@mon-cher-savon/contracts';
import { LoginUseCase } from '../../application/admin-auth.use-cases.js';
import type { AdminUserRepository } from '../../domain/ports/index.js';
import { ADMIN_USERS, AdminGuard, type AdminRequest } from './admin.guard.js';

export const COOKIE_SECURE = 'COOKIE_SECURE';

@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    @Inject(LoginUseCase) private readonly login: LoginUseCase,
    @Inject(ADMIN_USERS) private readonly admins: AdminUserRepository,
    @Inject(COOKIE_SECURE) private readonly secure: boolean,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login da vendedora (cookie httpOnly)' })
  async signIn(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const input = loginSchema.parse(body);
    const session = await this.login.execute({ ...input, clientKey: req.ip ?? 'unknown' });
    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      ...(session.maxAgeSeconds ? { maxAge: session.maxAgeSeconds * 1000 } : {}),
    });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Encerra a sessão' })
  signOut(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Quem está logada' })
  async me(@Req() req: AdminRequest): Promise<{ id: string; email: string }> {
    const admin = await this.admins.findById(req.adminId ?? '');
    return { id: admin?.id ?? '', email: admin?.email ?? '' };
  }
}
