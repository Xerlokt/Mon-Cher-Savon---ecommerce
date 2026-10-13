import { SESSION_COOKIE, verifySessionToken } from '@mon-cher-savon/contracts';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PANEL_PATHS = ['/painel/entrar', '/painel/manifest.webmanifest'];

/** Sends visitors without a valid session to the login page; logged-in sellers skip the login page. */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env['SESSION_SECRET'] ?? '',
  );

  if (pathname === '/painel/entrar') {
    return session ? NextResponse.redirect(new URL('/painel', request.url)) : NextResponse.next();
  }
  if (PUBLIC_PANEL_PATHS.includes(pathname) || session) return NextResponse.next();

  const login = new URL('/painel/entrar', request.url);
  if (pathname !== '/painel') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/painel/:path*'] };
