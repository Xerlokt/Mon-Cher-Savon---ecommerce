import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatusResponse,
} from '@mon-cher-savon/contracts';
import { PUBLIC_API_URL } from '@/shared/api-url';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  const res = await fetch(`${PUBLIC_API_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(body.message ?? 'Não foi possível finalizar o pedido.', res.status);
  }
  return (await res.json()) as CreateOrderResponse;
}

export async function fetchOrderStatus(code: string): Promise<OrderStatusResponse | null> {
  const res = await fetch(`${PUBLIC_API_URL}/api/v1/orders/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as OrderStatusResponse;
}

export interface ShippingOption {
  code: 'PICKUP' | 'LOCAL' | 'SHIPPING';
  label: string;
  priceCents: number;
}
