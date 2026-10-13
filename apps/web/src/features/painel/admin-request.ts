export const NETWORK_ERROR = 'Não consegui salvar. Confira a internet e toque em Tentar de novo.';
export const GENERIC_ERROR = 'Algo deu errado. Toque em Tentar de novo.';

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ErrorBody {
  message?: string;
  issues?: Array<{ message?: string }>;
}

function messageFrom(body: ErrorBody | null, status: number): string {
  if (status >= 500) return GENERIC_ERROR;
  const issue = body?.issues?.find((i) => i.message)?.message;
  return issue ?? body?.message ?? GENERIC_ERROR;
}

function goToLogin(): void {
  if (typeof window !== 'undefined') window.location.assign('/painel/entrar');
}

async function send<T>(method: string, path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', ...init });
  } catch {
    throw new AdminApiError(NETWORK_ERROR, 0);
  }
  if (res.status === 401 && !path.startsWith('/admin/auth/login')) {
    goToLogin();
    throw new AdminApiError('Faça login para continuar.', 401);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null;
    throw new AdminApiError(messageFrom(body, res.status), res.status);
  }
  return (await res.json().catch(() => ({}))) as T;
}

/** Calls the API through the same-origin proxy so the httpOnly session cookie is sent. */
export function adminRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return send<T>(method, path, {
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
}

export function adminUpload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return send<{ url: string }>('POST', '/admin/uploads', { body: form });
}

export function friendlyError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : GENERIC_ERROR;
}
