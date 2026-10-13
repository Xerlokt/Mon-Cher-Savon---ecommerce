// @vitest-environment node
import { SESSION_COOKIE, signSessionToken } from '@mon-cher-savon/contracts';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { middleware } from './middleware';

const SECRET = 'a-very-long-session-secret-for-tests-0123456789';

const request = (path: string, token?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });

let valid = '';
let expired = '';

beforeAll(async () => {
  process.env['SESSION_SECRET'] = SECRET;
  const now = Math.floor(Date.now() / 1000);
  valid = await signSessionToken({ sub: 'a1', exp: now + 3600 }, SECRET);
  expired = await signSessionToken({ sub: 'a1', exp: now - 10 }, SECRET);
});

const location = (res: Response) => res.headers.get('location');

describe('panel middleware', () => {
  it('sends visitors without a session to the login page, remembering where they were going', async () => {
    const res = await middleware(request('/painel/vendas/A7K2'));
    expect(location(res)).toBe(
      'http://localhost:3000/painel/entrar?next=%2Fpainel%2Fvendas%2FA7K2',
    );
    expect(location(await middleware(request('/painel')))).toBe(
      'http://localhost:3000/painel/entrar',
    );
  });

  it('rejects expired, forged and malformed cookies', async () => {
    expect(location(await middleware(request('/painel', expired)))).toContain('/painel/entrar');
    expect(location(await middleware(request('/painel', `${valid}x`)))).toContain('/painel/entrar');
    expect(location(await middleware(request('/painel', 'garbage')))).toContain('/painel/entrar');
    const other = await signSessionToken(
      { sub: 'a1', exp: Math.floor(Date.now() / 1000) + 3600 },
      'another-secret-another-secret-another',
    );
    expect(location(await middleware(request('/painel', other)))).toContain('/painel/entrar');
  });

  it('lets a valid session through', async () => {
    const res = await middleware(request('/painel/sabonetes', valid));
    expect(location(res)).toBeNull();
    expect(res.status).toBe(200);
  });

  it('keeps the login page open but bounces logged-in sellers to the panel', async () => {
    expect(location(await middleware(request('/painel/entrar')))).toBeNull();
    expect(location(await middleware(request('/painel/entrar', valid)))).toBe(
      'http://localhost:3000/painel',
    );
  });

  it('keeps the install manifest public', async () => {
    expect(location(await middleware(request('/painel/manifest.webmanifest')))).toBeNull();
  });

  it('closes the panel when no secret is configured', async () => {
    const saved = process.env['SESSION_SECRET'];
    delete process.env['SESSION_SECRET'];
    expect(location(await middleware(request('/painel', valid)))).toContain('/painel/entrar');
    process.env['SESSION_SECRET'] = saved;
  });
});
