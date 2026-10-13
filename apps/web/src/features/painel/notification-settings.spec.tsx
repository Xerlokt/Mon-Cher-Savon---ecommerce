import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotificationSettingResponse } from '@mon-cher-savon/contracts';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/shared/ui/toast';
import { NotificationSettings } from './notification-settings';

const settings: NotificationSettingResponse[] = [
  { channel: 'telegram', enabled: false, destination: '', available: true },
  { channel: 'whatsapp', enabled: false, destination: '', available: false },
];

const renderSettings = () =>
  render(
    <ToastProvider>
      <NotificationSettings settings={settings} />
    </ToastProvider>,
  );

const response = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe('NotificationSettings', () => {
  it('explains channels that are not available on the server', () => {
    renderSettings();
    const whatsapp = screen.getByRole('region', { name: 'WhatsApp' });
    expect(within(whatsapp).getByText(/ainda não foi ativado/)).toBeInTheDocument();
    expect(within(whatsapp).queryByRole('button')).not.toBeInTheDocument();
  });

  it('saves the channel with the typed destination', async () => {
    const fetchMock = response(200, {
      channel: 'telegram',
      enabled: true,
      destination: '123456789',
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSettings();
    await userEvent.click(screen.getByRole('switch', { name: 'Avisar aqui' }));
    await userEvent.type(screen.getByLabelText('Número do chat do Telegram'), '123456789');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Telegram salvo!')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/notifications/settings');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      channel: 'telegram',
      enabled: true,
      destination: '123456789',
    });
  });

  it('shows the server explanation when the destination is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      response(422, { message: 'Informe o número do seu chat do Telegram (só números).' }),
    );
    renderSettings();
    await userEvent.click(screen.getByRole('switch', { name: 'Avisar aqui' }));
    await userEvent.type(screen.getByLabelText('Número do chat do Telegram'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('só números');
  });

  it('sends a test message only when there is a destination', async () => {
    const fetchMock = response(200, { sent: true });
    vi.stubGlobal('fetch', fetchMock);
    renderSettings();
    const test = screen.getByRole('button', { name: 'Enviar mensagem de teste' });
    expect(test).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Número do chat do Telegram'), '123456789');
    await userEvent.click(test);
    expect(await screen.findByText('Mensagem enviada! Olhe o seu Telegram.')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/admin/notifications/test'),
    );
  });

  it('shows a friendly message when the test fails', async () => {
    vi.stubGlobal(
      'fetch',
      response(422, {
        message: 'Não consegui enviar a mensagem. Confira o destino e toque em Tentar de novo.',
      }),
    );
    renderSettings();
    await userEvent.type(screen.getByLabelText('Número do chat do Telegram'), '123456789');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem de teste' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui enviar a mensagem');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSettings();
    expect(await axe(container)).toHaveNoViolations();
  });
});
