import 'reflect-metadata';
import type { INestApplication, Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoginUseCase } from '../../../application/admin-auth.use-cases.js';
import {
  FakePasswordHasher,
  FakeSessionTokens,
  InMemoryAdmins,
  InMemoryLoginThrottle,
} from '../../../application/testing/fakes.js';
import { COOKIE_SECURE } from '../admin-auth.controller.js';
import { ADMIN_USERS, ALLOWED_ORIGIN, AdminGuard, SESSION_TOKENS } from '../admin.guard.js';
import { DomainExceptionFilter } from '../domain-exception.filter.js';

export const ORIGIN = 'http://localhost:3000';
export const SESSION_COOKIE_HEADER = 'mcs_session=token:a1';

/** Builds a Nest app with the real admin guard backed by fakes (an admin "a1" can log in). */
export async function createAdminTestApp(
  controllers: Type<unknown>[],
  providers: Provider[],
): Promise<INestApplication> {
  const admins = new InMemoryAdmins([
    { id: 'a1', email: 'ana@example.com', passwordHash: 'hash:segredo-forte' },
  ]);
  const moduleRef = await Test.createTestingModule({
    controllers,
    providers: [
      AdminGuard,
      { provide: SESSION_TOKENS, useValue: new FakeSessionTokens() },
      { provide: ADMIN_USERS, useValue: admins },
      { provide: ALLOWED_ORIGIN, useValue: ORIGIN },
      { provide: COOKIE_SECURE, useValue: false },
      {
        provide: LoginUseCase,
        useValue: new LoginUseCase(
          admins,
          new FakePasswordHasher(),
          new FakeSessionTokens(),
          new InMemoryLoginThrottle(3),
        ),
      },
      ...providers,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.init();
  return app;
}
