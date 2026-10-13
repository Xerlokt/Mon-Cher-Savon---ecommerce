import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchOrderStatus } from '@/features/checkout/api';
import { OrderTracker } from '@/features/pedido/order-tracker';

export const metadata: Metadata = {
  title: 'Seu pedido',
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await fetchOrderStatus(code);
  if (!order) notFound();
  return <OrderTracker initial={order} />;
}
