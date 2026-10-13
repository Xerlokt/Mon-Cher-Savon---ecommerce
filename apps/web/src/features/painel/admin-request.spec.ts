import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminApiError,
  GENERIC_ERROR,
  NETWORK_ERROR,
  adminRequest,
  adminUpload,
  friendlyError,
} from './admin-request';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.stubGlobal('fetch', respond(200, { ok: true }));
});
afterEach(() => vi.unstubAllGlobals());

describe('adminRequest', () => {
  it('sends JSON through the same-origin proxy with credentials', async () => {
    const fetchMock = respond(200, { stock: 4 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await adminRequest<{ stock: number }>(
      'POST',
      '/admin/products/p1/stock-adjustments',
      {
        delta: 1,
      },
    );
    expect(result.stock).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/products/p1/stock-adjustments',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ delta: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('turns network failures into a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(adminRequest('GET', '/admin/orders')).rejects.toMatchObject({
      message: NETWORK_ERROR,
      status: 0,
    });
  });

  it('prefers the first validation message, then the API message', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { message: 'Dados inválidos', issues: [{ message: 'Informe o preço' }] }),
    );
    await expect(adminRequest('POST', '/admin/products', {})).rejects.toThrow('Informe o preço');
    vi.stubGlobal('fetch', respond(422, { message: 'Estoque insuficiente' }));
    await expect(adminRequest('POST', '/x', {})).rejects.toThrow('Estoque insuficiente');
  });

  it('hides server error details', async () => {
    vi.stubGlobal('fetch', respond(500, { message: 'stack trace here' }));
    await expect(adminRequest('GET', '/x')).rejects.toThrow(GENERIC_ERROR);
  });

  it('sends the seller to the login page when the session is gone', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('fetch', respond(401, { message: 'x' }));
    await expect(adminRequest('GET', '/admin/orders')).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith('/painel/entrar');
  });

  it('does not redirect on a wrong password', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('fetch', respond(401, { message: 'E-mail ou senha incorretos.' }));
    await expect(adminRequest('POST', '/admin/auth/login', {})).rejects.toThrow('E-mail ou senha');
    expect(assign).not.toHaveBeenCalled();
  });

  it('uploads files as multipart without forcing a content type', async () => {
    const fetchMock = respond(201, { url: '/uploads/a.png' });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect((await adminUpload(file)).url).toBe('/uploads/a.png');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined();
  });
});

describe('friendlyError', () => {
  it('uses API messages and falls back for unknown errors', () => {
    expect(friendlyError(new AdminApiError('Oi', 422))).toBe('Oi');
    expect(friendlyError(new Error('boom'))).toBe(GENERIC_ERROR);
  });
});
