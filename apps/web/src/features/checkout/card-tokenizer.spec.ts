import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_FIELD_IDS, CardTokenizeError, createMercadoPagoTokenizer } from './card-tokenizer';

type Handler = (data: { bin?: string | null }) => void;

function installFakeSdk(options: { methods?: Array<{ id: string }>; tokenFails?: boolean } = {}) {
  const mounted: string[] = [];
  const unmounted: string[] = [];
  let binHandler: Handler = () => undefined;
  const createCardToken = vi.fn(async () => {
    if (options.tokenFails) throw new Error('invalid');
    return { id: 'tok_123' };
  });
  const ctor = vi.fn(() => ({
    fields: {
      create: (type: string) => ({
        mount: (id: string) => mounted.push(id),
        unmount: () => unmounted.push(type),
        on: (_event: string, handler: Handler) => {
          if (type === 'cardNumber') binHandler = handler;
        },
      }),
      createCardToken,
    },
    getPaymentMethods: vi.fn(async () => ({ results: options.methods ?? [{ id: 'visa' }] })),
  }));
  window.MercadoPago = ctor as never;
  return {
    ctor,
    mounted,
    unmounted,
    createCardToken,
    typeBin: (bin: string) => binHandler({ bin }),
  };
}

beforeEach(() => {
  delete window.MercadoPago;
});
afterEach(() => {
  delete window.MercadoPago;
});

describe('createMercadoPagoTokenizer', () => {
  it('mounts the three secure fields and returns only a token and the card brand', async () => {
    const sdk = installFakeSdk();
    const tokenizer = createMercadoPagoTokenizer('TEST-public-key');
    await tokenizer.mount();

    expect(sdk.ctor).toHaveBeenCalledWith('TEST-public-key', { locale: 'pt-BR' });
    expect(sdk.mounted).toEqual([CARD_FIELD_IDS.number, CARD_FIELD_IDS.expiry, CARD_FIELD_IDS.cvv]);

    sdk.typeBin('45031234');
    const result = await tokenizer.tokenize({ name: 'MARIA SOUZA', cpf: '12345678909' });
    expect(result).toEqual({ token: 'tok_123', paymentMethodId: 'visa' });
    expect(sdk.createCardToken).toHaveBeenCalledWith({
      cardholderName: 'MARIA SOUZA',
      identificationType: 'CPF',
      identificationNumber: '12345678909',
    });
  });

  it('refuses to tokenize before the card number was typed', async () => {
    installFakeSdk();
    const tokenizer = createMercadoPagoTokenizer('k');
    await tokenizer.mount();
    await expect(tokenizer.tokenize({ name: 'A', cpf: '1' })).rejects.toBeInstanceOf(
      CardTokenizeError,
    );
  });

  it('turns SDK failures and unknown cards into one friendly error', async () => {
    const failing = installFakeSdk({ tokenFails: true });
    const a = createMercadoPagoTokenizer('k');
    await a.mount();
    failing.typeBin('45031234');
    await expect(a.tokenize({ name: 'A', cpf: '1' })).rejects.toThrow(/Confira os dados do cartão/);

    const unknown = installFakeSdk({ methods: [] });
    const b = createMercadoPagoTokenizer('k');
    await b.mount();
    unknown.typeBin('00000000');
    await expect(b.tokenize({ name: 'A', cpf: '1' })).rejects.toBeInstanceOf(CardTokenizeError);
  });

  it('unmounts the fields and forgets the card', async () => {
    const sdk = installFakeSdk();
    const tokenizer = createMercadoPagoTokenizer('k');
    await tokenizer.mount();
    tokenizer.unmount();
    expect(sdk.unmounted).toHaveLength(3);
    await expect(tokenizer.tokenize({ name: 'A', cpf: '1' })).rejects.toBeInstanceOf(
      CardTokenizeError,
    );
  });
});
