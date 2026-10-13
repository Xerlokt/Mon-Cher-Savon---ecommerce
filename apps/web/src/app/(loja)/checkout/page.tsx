import type { Metadata } from 'next';
import { CheckoutForm } from '@/features/checkout/checkout-form';
import type { ShippingOption } from '@/features/checkout/api';

export const metadata: Metadata = {
  title: 'Finalizar compra',
  robots: { index: false },
};

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

async function getShippingOptions(): Promise<ShippingOption[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/shipping-options`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as ShippingOption[];
  } catch {
    return [];
  }
}

export default async function CheckoutPage() {
  const shippingOptions = await getShippingOptions();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-sage-700">Finalizar compra</h1>
      {shippingOptions.length === 0 ? (
        <p role="alert">
          Não conseguimos carregar as opções de entrega agora. Atualize a página em instantes.
        </p>
      ) : (
        <CheckoutForm shippingOptions={shippingOptions} />
      )}
    </div>
  );
}
