import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm, safeNext } from './login-form';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function fill(email = 'ana@example.com', password = 'segredo-forte') {
  if (email) await userEvent.type(screen.getByLabelText('E-mail'), email);
  if (password) await userEvent.type(screen.getByLabelText('Senha'), password);
}

describe('safeNext', () => {
  it('only allows paths inside the panel', () => {
    expect(safeNext('/painel/vendas')).toBe('/painel/vendas');
    expect(safeNext('https://evil.test')).toBe('/painel');
    expect(safeNext('//evil.test')).toBe('/painel');
    expect(safeNext('/outra-coisa')).toBe('/painel');
    expect(safeNext(undefined)).toBe('/painel');
  });
});

describe('LoginForm', () => {
  it('logs in with "lembrar de mim" on by default and goes where she was going', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginForm next="/painel/vendas/A7K2" />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel/vendas/A7K2'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/auth/login');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'ana@example.com',
      password: 'segredo-forte',
      remember: true,
    });
  });

  it('can turn off remember-me', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginForm />);
    await fill();
    await userEvent.click(screen.getByLabelText('Lembrar de mim por 30 dias'));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel'));
    expect(
      JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).remember,
    ).toBe(false);
  });

  it('asks for the missing fields without calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Digite o seu e-mail e a sua senha.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server message for a wrong password and lets her try again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'E-mail ou senha incorretos.' }),
      }),
    );
    render(<LoginForm />);
    await fill('ana@example.com', 'errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('can show the password', async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByLabelText('Mostrar a senha'));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
