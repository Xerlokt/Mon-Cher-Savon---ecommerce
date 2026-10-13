import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/shared/ui/toast';
import { StockStepper } from './stock-stepper';

const renderStepper = (stock = 3) =>
  render(
    <ToastProvider>
      <StockStepper productId="p1" name="Lavanda" initialStock={stock} />
    </ToastProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('StockStepper', () => {
  it('adds one, saves with the reason and shows the number returned by the server', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ stock: 4 }) });
    vi.stubGlobal('fetch', fetchMock);
    renderStepper(3);
    await userEvent.click(screen.getByRole('button', { name: 'Colocar mais um Lavanda' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('4'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/products/p1/stock-adjustments');
    expect(JSON.parse(String(init.body))).toEqual({ delta: 1, reason: 'RESTOCK' });
  });

  it('removes one with the adjustment reason and disables − at zero', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ stock: 0 }) });
    vi.stubGlobal('fetch', fetchMock);
    renderStepper(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar um Lavanda' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tirar um Lavanda' })).toBeDisabled(),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      delta: -1,
      reason: 'ADJUSTMENT',
    });
  });

  it('goes back to the previous number and explains when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderStepper(3);
    await userEvent.click(screen.getByRole('button', { name: 'Colocar mais um Lavanda' }));
    expect(await screen.findByText(/Não consegui salvar/)).toBeInTheDocument();
    expect(
      screen.getByLabelText('Quantos tenho: Lavanda').querySelector('output'),
    ).toHaveTextContent('3');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStepper();
    expect(await axe(container)).toHaveNoViolations();
  });
});
