import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY } from '@/features/carrinho/cart';
import { CartProvider } from '@/features/carrinho/cart-provider';
import { CheckoutForm, pixStorageKey } from './checkout-form';
import type { ShippingOption } from './api';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const shippingOptions: ShippingOption[] = [
  { code: 'PICKUP', label: 'Retirada', priceCents: 0 },
  { code: 'LOCAL', label: 'Entrega local', priceCents: 1000 },
];

const productId = '3f1c2b4e-8a1d-4c55-9d0e-1a2b3c4d5e6f';

function seedCart() {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({
      items: [
        {
          productId,
          slug: 'lavanda',
          name: 'Lavanda',
          priceCents: 1800,
          imageUrl: null,
          quantity: 2,
        },
      ],
    }),
  );
}

const renderForm = (props: Partial<Parameters<typeof CheckoutForm>[0]> = {}) =>
  render(
    <CartProvider>
      <CheckoutForm shippingOptions={shippingOptions} {...props} />
    </CartProvider>,
  );

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
  await user.type(screen.getByLabelText('WhatsApp'), '(11) 91234-5678');
  await user.type(screen.getByLabelText('E-mail'), 'maria@example.com');
  await user.type(screen.getByLabelText('CEP'), '01310100');
  await user.type(screen.getByLabelText('Número'), '120');
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockReset();
  seedCart();
});

describe('CheckoutForm', () => {
  it('shows an empty-cart message when there is nothing to buy', async () => {
    window.localStorage.clear();
    renderForm();
    expect(await screen.findByText('Seu carrinho está vazio.')).toBeInTheDocument();
  });

  it('fills the address from the CEP and recomputes the total with shipping', async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue({
      street: 'Avenida Paulista',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    renderForm({ lookup });
    await screen.findByText(/2x Lavanda/);

    await user.type(screen.getByLabelText('CEP'), '01310-100');
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista'));
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    expect(screen.getByLabelText('UF')).toHaveValue('SP');

    expect(screen.getByTestId('total').textContent?.replace(/\s/g, ' ')).toBe('R$ 36,00');
    await user.click(screen.getByLabelText(/Entrega local/));
    expect(screen.getByTestId('total').textContent?.replace(/\s/g, ' ')).toBe('R$ 46,00');
  });

  it('warns when the CEP is not found but lets the user type the address', async () => {
    const user = userEvent.setup();
    renderForm({ lookup: vi.fn().mockResolvedValue(null) });
    await screen.findByText(/2x Lavanda/);
    await user.type(screen.getByLabelText('CEP'), '00000000');
    expect(await screen.findByText(/Não encontramos esse CEP/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Rua'), 'Rua Qualquer');
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Qualquer');
  });

  it('shows field errors and does not call the API when data is invalid', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn();
    renderForm({ createOrder });
    await screen.findByText(/2x Lavanda/);
    await user.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos');
    expect(screen.getByLabelText('Nome completo')).toHaveAttribute('aria-invalid', 'true');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('submits a valid order, stores the Pix data, clears the cart and goes to the order page', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockResolvedValue({
      publicCode: 'A7K2QX',
      totalCents: 3600,
      payment: { pixCopyPaste: '000201pix' },
    });
    const lookup = vi.fn().mockResolvedValue({
      street: 'Avenida Paulista',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    renderForm({ createOrder, lookup });
    await screen.findByText(/2x Lavanda/);
    await fillValid(user);
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista'));

    await user.click(screen.getByRole('button', { name: 'Pagar com Pix' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/pedido/A7K2QX'));
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ productId, quantity: 2 }],
        customer: expect.objectContaining({ phone: '11912345678' }),
        shippingOption: 'PICKUP',
        paymentMethod: 'PIX',
      }),
    );
    expect(JSON.parse(window.sessionStorage.getItem(pixStorageKey('A7K2QX')) ?? '{}')).toEqual({
      pixCopyPaste: '000201pix',
    });
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '{}').items).toEqual([]);
  });

  it('shows the API error and keeps the cart when the order fails', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockRejectedValue(new Error('Estoque insuficiente para Lavanda'));
    renderForm({
      createOrder,
      lookup: vi.fn().mockResolvedValue({
        street: 'Rua A',
        district: 'Centro',
        city: 'SP',
        state: 'SP',
      }),
    });
    await screen.findByText(/2x Lavanda/);
    await fillValid(user);
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua A'));
    await user.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Estoque insuficiente');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pagar com Pix' })).toBeEnabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderForm();
    await screen.findByText(/2x Lavanda/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
