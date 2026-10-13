import { act, render, screen } from '@testing-library/react';
import type { OrderStatusResponse } from '@mon-cher-savon/contracts';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pixStorageKey } from '@/features/checkout/checkout-form';
import { OrderTracker } from './order-tracker';

const order = (status: OrderStatusResponse['status']): OrderStatusResponse => ({
  publicCode: 'A7K2QX',
  status,
  items: [{ productName: 'Lavanda', quantity: 2, unitPriceCents: 1800 }],
  shippingCents: 1000,
  totalCents: 4600,
  createdAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OrderTracker', () => {
  it('shows the Pix code stored at checkout while awaiting payment', () => {
    window.sessionStorage.setItem(
      pixStorageKey('A7K2QX'),
      JSON.stringify({ pixCopyPaste: '000201abc', pixQrCodeBase64: 'iVBOR' }),
    );
    render(<OrderTracker initial={order('AWAITING_PAYMENT')} fetchStatus={vi.fn()} />);
    expect(screen.getByText('Aguardando o pagamento')).toBeInTheDocument();
    expect(screen.getByText('000201abc')).toBeInTheDocument();
    expect(screen.getByAltText('QR Code do Pix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar código Pix' })).toBeInTheDocument();
  });

  it('explains when the Pix data is not on this device', () => {
    render(<OrderTracker initial={order('AWAITING_PAYMENT')} fetchStatus={vi.fn()} />);
    expect(screen.getByText(/Não encontramos o código Pix/)).toBeInTheDocument();
  });

  it('polls and switches to the confirmed state once paid, then stops polling', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(order('AWAITING_PAYMENT'))
      .mockResolvedValue(order('PAID'));
    render(
      <OrderTracker
        initial={order('AWAITING_PAYMENT')}
        fetchStatus={fetchStatus}
        intervalMs={1000}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('Aguardando o pagamento')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('Pedido confirmado!')).toBeInTheDocument();
    expect(screen.queryByText('Pague com Pix')).not.toBeInTheDocument();

    const calls = fetchStatus.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchStatus.mock.calls.length).toBe(calls);
  });

  it('keeps the last known state when polling fails', async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error('offline'));
    render(
      <OrderTracker
        initial={order('AWAITING_PAYMENT')}
        fetchStatus={fetchStatus}
        intervalMs={1000}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.getByText('Aguardando o pagamento')).toBeInTheDocument();
  });

  it('renders cancelled orders without payment instructions', () => {
    render(<OrderTracker initial={order('CANCELLED')} fetchStatus={vi.fn()} />);
    expect(screen.getByText('Pedido cancelado')).toBeInTheDocument();
    expect(screen.queryByText('Pague com Pix')).not.toBeInTheDocument();
  });

  it('copies the Pix code to the clipboard', async () => {
    window.sessionStorage.setItem(
      pixStorageKey('A7K2QX'),
      JSON.stringify({ pixCopyPaste: '000201abc' }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<OrderTracker initial={order('AWAITING_PAYMENT')} fetchStatus={vi.fn()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Copiar código Pix' }).click();
    });
    expect(writeText).toHaveBeenCalledWith('000201abc');
    expect(screen.getByRole('button', { name: 'Código copiado!' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    const { container } = render(<OrderTracker initial={order('PAID')} fetchStatus={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
