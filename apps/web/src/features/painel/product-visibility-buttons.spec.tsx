import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/shared/ui/toast';
import { PutBackButton, RemoveFromStoreButton } from './product-visibility-buttons';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const ok = () => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

beforeEach(() => refresh.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('RemoveFromStoreButton', () => {
  it('confirms in a sentence, archives, and lets her undo right away', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <RemoveFromStoreButton productId="p1" name="Lavanda" />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tirar da loja' }));
    expect(await screen.findByText('Tirar "Lavanda" da loja?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sim, tirar da loja' }));

    expect(await screen.findByText('"Lavanda" saiu da loja.')).toBeInTheDocument();
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE');

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/admin/products/p1/restore');
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].method).toBe('POST');
  });

  it('keeps the product and explains when archiving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(
      <ToastProvider>
        <RemoveFromStoreButton productId="p1" name="Lavanda" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tirar da loja' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, tirar da loja' }));
    expect(await screen.findByText(/Confira a internet/)).toBeInTheDocument();
    expect(screen.queryByText('"Lavanda" saiu da loja.')).not.toBeInTheDocument();
  });

  it('auto-dismisses the undo option after 10 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', ok());
    render(
      <ToastProvider>
        <RemoveFromStoreButton productId="p1" name="Lavanda" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tirar da loja' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, tirar da loja' }));
    expect(await screen.findByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(10_100);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument(),
    );
    vi.useRealTimers();
  });
});

describe('PutBackButton', () => {
  it('restores the product', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ToastProvider>
        <PutBackButton productId="p1" name="Lavanda" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Colocar de volta na loja' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText('"Lavanda" voltou para a loja.')).toBeInTheDocument();
  });
});
