import type { PaymentGateway } from '../../domain/ports/index.js';

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

export interface MercadoPagoConfig {
  accessToken: string;
  baseUrl?: string;
  notificationUrl?: string;
  pixExpirationMinutes?: number;
}

interface MpPayment {
  id: number | string;
  status: string;
  external_reference?: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
}

type CreateInput = Parameters<PaymentGateway['createPayment']>[0];

export class MercadoPagoGateway implements PaymentGateway {
  private readonly baseUrl: string;

  constructor(private readonly config: MercadoPagoConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.mercadopago.com';
  }

  async createPayment(input: CreateInput) {
    const body: Record<string, unknown> = {
      transaction_amount: input.amountCents / 100,
      description: 'Mon Cher Savon — pedido',
      external_reference: input.orderId,
      payer: { email: input.payerEmail },
      ...(this.config.notificationUrl ? { notification_url: this.config.notificationUrl } : {}),
    };

    if (input.method === 'PIX') {
      body['payment_method_id'] = 'pix';
      const minutes = this.config.pixExpirationMinutes ?? 30;
      body['date_of_expiration'] = new Date(Date.now() + minutes * 60_000).toISOString();
    } else {
      if (!input.cardToken || !input.cardPaymentMethodId) {
        throw new PaymentGatewayError('Dados do cartão incompletos');
      }
      body['token'] = input.cardToken;
      body['payment_method_id'] = input.cardPaymentMethodId;
      body['installments'] = 1;
    }

    const payment = await this.request<MpPayment>('POST', '/v1/payments', body, input.orderId);
    const pix = payment.point_of_interaction?.transaction_data;
    return {
      providerPaymentId: String(payment.id),
      ...(pix?.qr_code ? { pixCopyPaste: pix.qr_code } : {}),
      ...(pix?.qr_code_base64 ? { pixQrCodeBase64: pix.qr_code_base64 } : {}),
    };
  }

  async getPayment(providerPaymentId: string) {
    const payment = await this.request<MpPayment>(
      'GET',
      `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
    );
    return {
      status: mapStatus(payment.status),
      orderId: payment.external_reference ?? '',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      throw new PaymentGatewayError(`Mercado Pago respondeu ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  }
}

function mapStatus(status: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (status === 'approved') return 'APPROVED';
  if (['pending', 'in_process', 'authorized'].includes(status)) return 'PENDING';
  return 'REJECTED';
}
