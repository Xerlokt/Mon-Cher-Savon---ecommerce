import { describe, expect, it } from 'vitest';
import { createOrderSchema } from './checkout.js';

const valid = {
  items: [{ productId: '3f1c2b4e-8a1d-4c55-9d0e-1a2b3c4d5e6f', quantity: 2 }],
  customer: { name: 'Maria Souza', phone: '(11) 91234-5678', email: 'maria@example.com' },
  address: {
    cep: '01310-100',
    street: 'Rua das Flores',
    number: '120',
    district: 'Centro',
    city: 'São Paulo',
    state: 'sp',
  },
  shippingOption: 'LOCAL',
  paymentMethod: 'PIX',
};

describe('createOrderSchema', () => {
  it('accepts a valid order and normalizes phone and state', () => {
    const parsed = createOrderSchema.parse(valid);
    expect(parsed.customer.phone).toBe('11912345678');
    expect(parsed.address.state).toBe('SP');
  });

  it('rejects empty carts and absurd quantities', () => {
    expect(createOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({
        ...valid,
        items: [{ productId: valid.items[0]!.productId, quantity: 100 }],
      }).success,
    ).toBe(false);
  });

  it('rejects invalid email, phone and CEP', () => {
    expect(
      createOrderSchema.safeParse({ ...valid, customer: { ...valid.customer, email: 'x' } })
        .success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...valid, customer: { ...valid.customer, phone: '123' } })
        .success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...valid, address: { ...valid.address, cep: '1' } }).success,
    ).toBe(false);
  });

  it('requires a card token only for card payments', () => {
    expect(createOrderSchema.safeParse({ ...valid, paymentMethod: 'CARD' }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({
        ...valid,
        paymentMethod: 'CARD',
        cardToken: 'tok_123',
        cardPaymentMethodId: 'visa',
      }).success,
    ).toBe(true);
  });
});
