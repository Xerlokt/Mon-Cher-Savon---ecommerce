// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase } from './api-url';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['API_URL'];
});

describe('apiBase', () => {
  it('calls the API directly on the server', () => {
    expect(apiBase()).toBe('http://localhost:3001');
    process.env['API_URL'] = 'http://api.internal:3001';
    expect(apiBase()).toBe('http://api.internal:3001');
  });

  it('is relative in the browser so the same-origin proxy and the CSP work', () => {
    vi.stubGlobal('window', {});
    expect(apiBase()).toBe('');
  });
});
