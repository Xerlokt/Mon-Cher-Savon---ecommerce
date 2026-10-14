import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY } from '@/features/carrinho/cart';
import { CartProvider } from '@/features/carrinho/cart-provider';
import { CheckoutForm, pixStorageKey } from './checkout-form';
import type { ShippingOption } from './api';
import type { CardTokenizer } from './card-tokenizer';

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

  describe('pagamento com cartão', () => {
    const fakeTokenizer = (overrides: Partial<CardTokenizer> = {}): CardTokenizer => ({
      mount: vi.fn().mockResolvedValue(undefined),
      tokenize: vi.fn().mockResolvedValue({ token: 'tok_1', paymentMethodId: 'visa' }),
      unmount: vi.fn(),
      ...overrides,
    });
    const result = { publicCode: 'A7K2', totalCents: 4600, payment: {} };

    async function fillCard(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Nome impresso no cartão'), 'MARIA SOUZA');
      await user.type(screen.getByLabelText('CPF do titular'), '529.982.247-25');
    }

    it('offers only Pix when there is no public key', async () => {
      renderForm();
      await screen.findByLabelText('Nome completo');
      expect(screen.queryByRole('radio', { name: /Cartão/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pagar com Pix' })).toBeInTheDocument();
    });

    it('mounts the secure fields on choosing card and removes them when going back to Pix', async () => {
      const user = userEvent.setup();
      const tokenizer = fakeTokenizer();
      const createTokenizer = vi.fn().mockReturnValue(tokenizer);
      renderForm({ cardPublicKey: 'TEST-key', createTokenizer });

      await user.click(await screen.findByRole('radio', { name: /Cartão/ }));
      await waitFor(() => expect(tokenizer.mount).toHaveBeenCalled());
      expect(createTokenizer).toHaveBeenCalledWith('TEST-key');
      expect(screen.getByRole('button', { name: 'Pagar com cartão' })).toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: /Pix/ }));
      expect(tokenizer.unmount).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Pagar com Pix' })).toBeInTheDocument();
    });

    it('sends only the token and the brand, never card data', async () => {
      const user = userEvent.setup();
      const tokenizer = fakeTokenizer();
      const createOrder = vi.fn().mockResolvedValue(result);
      renderForm({ cardPublicKey: 'TEST-key', createTokenizer: () => tokenizer, createOrder });
      await fillValid(user);
      await user.click(screen.getByRole('radio', { name: /Cartão/ }));
      await fillCard(user);
      await user.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

      await waitFor(() => expect(push).toHaveBeenCalledWith('/pedido/A7K2'));
      expect(tokenizer.tokenize).toHaveBeenCalledWith({ name: 'MARIA SOUZA', cpf: '52998224725' });
      const payload = createOrder.mock.calls[0]?.[0];
      expect(payload).toMatchObject({
        paymentMethod: 'CARD',
        cardToken: 'tok_1',
        cardPaymentMethodId: 'visa',
      });
      expect(JSON.stringify(payload)).not.toContain('52998224725');
    });

    it('asks for the holder name and a valid CPF before tokenizing', async () => {
      const user = userEvent.setup();
      const tokenizer = fakeTokenizer();
      const createOrder = vi.fn();
      renderForm({ cardPublicKey: 'TEST-key', createTokenizer: () => tokenizer, createOrder });
      await fillValid(user);
      await user.click(screen.getByRole('radio', { name: /Cartão/ }));
      await user.type(screen.getByLabelText('CPF do titular'), '111.111.111-11');
      await user.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

      expect(await screen.findByText('Informe o nome como está no cartão')).toBeInTheDocument();
      expect(screen.getByText('CPF inválido')).toBeInTheDocument();
      expect(tokenizer.tokenize).not.toHaveBeenCalled();
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('explains a card that could not be read and does not create the order', async () => {
      const user = userEvent.setup();
      const tokenizer = fakeTokenizer({
        tokenize: vi
          .fn()
          .mockRejectedValue(new Error('Confira os dados do cartão e tente de novo.')),
      });
      const createOrder = vi.fn();
      renderForm({ cardPublicKey: 'TEST-key', createTokenizer: () => tokenizer, createOrder });
      await fillValid(user);
      await user.click(screen.getByRole('radio', { name: /Cartão/ }));
      await fillCard(user);
      await user.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Confira os dados do cartão');
      expect(createOrder).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Pagar com cartão' })).toBeEnabled();
    });

    it('shows the refusal from the bank and lets the customer try again', async () => {
      const user = userEvent.setup();
      const createOrder = vi
        .fn()
        .mockRejectedValue(new Error('O pagamento foi recusado. Confira os dados do cartão.'));
      renderForm({
        cardPublicKey: 'TEST-key',
        createTokenizer: () => fakeTokenizer(),
        createOrder,
      });
      await fillValid(user);
      await user.click(screen.getByRole('radio', { name: /Cartão/ }));
      await fillCard(user);
      await user.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('O pagamento foi recusado');
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Pagar com cartão' })).toBeEnabled();
    });

    it('has no accessibility violations with the card form open', async () => {
      const user = userEvent.setup();
      const { container } = renderForm({
        cardPublicKey: 'TEST-key',
        createTokenizer: () => fakeTokenizer(),
      });
      await user.click(await screen.findByRole('radio', { name: /Cartão/ }));
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
