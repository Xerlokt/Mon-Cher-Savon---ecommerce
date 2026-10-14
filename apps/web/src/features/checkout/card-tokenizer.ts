/**
 * Card data never touches our servers: MercadoPago.js renders the number, expiry and security code
 * in its own iframes ("Secure Fields") and hands back a one-time token. Only the token is sent to
 * the API. This file is the single place that knows the SDK, so the form can be tested with a fake.
 */

export const CARD_FIELD_IDS = {
  number: 'mp-card-number',
  expiry: 'mp-card-expiry',
  cvv: 'mp-card-cvv',
} as const;

export interface CardHolder {
  name: string;
  /** Digits only. */
  cpf: string;
}

export interface CardTokenizer {
  /** Renders the secure fields inside the containers identified by `CARD_FIELD_IDS`. */
  mount(): Promise<void>;
  tokenize(holder: CardHolder): Promise<{ token: string; paymentMethodId: string }>;
  unmount(): void;
}

export type CardTokenizerFactory = (publicKey: string) => CardTokenizer;

export class CardTokenizeError extends Error {
  constructor(message = 'Confira os dados do cartão e tente de novo.') {
    super(message);
    this.name = 'CardTokenizeError';
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

interface SecureField {
  mount(containerId: string): void;
  unmount(): void;
  on(event: 'binChange', handler: (data: { bin?: string | null }) => void): void;
}

interface MercadoPagoInstance {
  fields: {
    create(
      type: 'cardNumber' | 'expirationDate' | 'securityCode',
      options?: { placeholder?: string },
    ): SecureField;
    createCardToken(data: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }): Promise<{ id: string }>;
  };
  getPaymentMethods(query: { bin: string }): Promise<{ results: Array<{ id: string }> }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

let sdkLoading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new CardTokenizeError());
  if (window.MercadoPago) return Promise.resolve();
  sdkLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoading = null; // allow a retry
      reject(new CardTokenizeError('Não foi possível carregar o pagamento por cartão. Use o Pix.'));
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

export const createMercadoPagoTokenizer: CardTokenizerFactory = (publicKey) => {
  let mp: MercadoPagoInstance | null = null;
  let fields: SecureField[] = [];
  let bin: string | null = null;

  return {
    async mount() {
      await loadSdk();
      const Sdk = window.MercadoPago;
      if (!Sdk) throw new CardTokenizeError();
      mp = new Sdk(publicKey, { locale: 'pt-BR' });
      const number = mp.fields.create('cardNumber', { placeholder: '0000 0000 0000 0000' });
      const expiry = mp.fields.create('expirationDate', { placeholder: 'MM/AA' });
      const cvv = mp.fields.create('securityCode', { placeholder: 'CVV' });
      number.on('binChange', (data) => {
        bin = data.bin ?? null;
      });
      number.mount(CARD_FIELD_IDS.number);
      expiry.mount(CARD_FIELD_IDS.expiry);
      cvv.mount(CARD_FIELD_IDS.cvv);
      fields = [number, expiry, cvv];
    },

    async tokenize(holder) {
      if (!mp || !bin) throw new CardTokenizeError();
      try {
        const methods = await mp.getPaymentMethods({ bin });
        const paymentMethodId = methods.results[0]?.id;
        if (!paymentMethodId) throw new CardTokenizeError();
        const { id } = await mp.fields.createCardToken({
          cardholderName: holder.name,
          identificationType: 'CPF',
          identificationNumber: holder.cpf,
        });
        return { token: id, paymentMethodId };
      } catch (error) {
        throw error instanceof CardTokenizeError ? error : new CardTokenizeError();
      }
    },

    unmount() {
      for (const field of fields) {
        try {
          field.unmount();
        } catch {
          // The container may already be gone.
        }
      }
      fields = [];
      mp = null;
      bin = null;
    },
  };
};
