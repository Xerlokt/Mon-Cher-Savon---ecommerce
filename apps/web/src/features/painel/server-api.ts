import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

/** Server-side GET to the admin API, forwarding the seller's session cookie. */
export async function adminGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
  } catch {
    throw new Error('API indisponível');
  }
  if (res.status === 401) redirect('/painel/entrar');
  if (!res.ok) throw new AdminServerError(res.status);
  return (await res.json()) as T;
}

export class AdminServerError extends Error {
  constructor(readonly status: number) {
    super(`API respondeu ${status}`);
  }
}
