import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/shared/ui/toast';
import { OrderActions } from './order-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const renderActions = (status: Parameters<typeof OrderActions>[0]['status'], compact = false) =>
  render(
    <ToastProvider>
      <OrderActions orderId="o1" status={status} compact={compact} />
    </ToastProvider>,
  );

const ok = () =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });

beforeEach(() => refresh.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('OrderActions', () => {
  it('marks a paid sale as shipped with one tap', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    renderActions('PAID');
    await userEvent.click(screen.getByRole('button', { name: 'Marquei como enviado' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/orders/o1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'SHIPPED' });
    expect(await screen.findByText('Pronto! Marcado como enviado.')).toBeInTheDocument();
  });

  it('offers delivered after shipping', async () => {
    vi.stubGlobal('fetch', ok());
    renderActions('SHIPPED');
    expect(screen.queryByRole('button', { name: 'Marquei como enviado' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marquei como entregue' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('asks in plain words before cancelling and then cancels', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    renderActions('PAID');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar esta venda' }));
    expect(await screen.findByText('Cancelar esta venda?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar a venda' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      status: 'CANCELLED',
    });
  });

  it.each(['PAID', 'SHIPPED', 'DELIVERED'] as const)(
    'asks before giving the money back on a %s sale, then refunds',
    async (status) => {
      const fetchMock = ok();
      vi.stubGlobal('fetch', fetchMock);
      renderActions(status);
      await userEvent.click(screen.getByRole('button', { name: 'Devolver o dinheiro' }));
      expect(await screen.findByText('Devolver o dinheiro ao cliente?')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Sim, devolver o dinheiro' }));
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/admin/orders/o1/refund');
      expect(init.method).toBe('POST');
      expect(await screen.findByText('Dinheiro devolvido ao cliente.')).toBeInTheDocument();
    },
  );

  it('does not offer a refund before payment, in lists, or after the money went back', () => {
    renderActions('AWAITING_PAYMENT');
    expect(screen.queryByRole('button', { name: 'Devolver o dinheiro' })).not.toBeInTheDocument();
    renderActions('PAID', true);
    expect(screen.queryByRole('button', { name: 'Devolver o dinheiro' })).not.toBeInTheDocument();
    renderActions('REFUNDED');
    expect(screen.queryByRole('button', { name: 'Devolver o dinheiro' })).not.toBeInTheDocument();
  });

  it('keeps the sale as it was and explains when the refund fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderActions('PAID');
    await userEvent.click(screen.getByRole('button', { name: 'Devolver o dinheiro' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, devolver o dinheiro' }));
    expect(await screen.findByText(/Confira a internet/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows a friendly error and does not refresh when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderActions('PAID');
    await userEvent.click(screen.getByRole('button', { name: 'Marquei como enviado' }));
    expect(await screen.findByText(/Confira a internet/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows only the main action in compact mode and nothing for finished sales', () => {
    renderActions('PAID', true);
    expect(screen.queryByRole('button', { name: 'Cancelar esta venda' })).not.toBeInTheDocument();
    renderActions('CANCELLED');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
