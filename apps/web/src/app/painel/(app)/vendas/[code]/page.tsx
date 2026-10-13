import type { AdminOrderDetail } from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCep, formatDateTime, formatPhone } from '@/features/painel/labels';
import { OrderActions } from '@/features/painel/order-actions';
import { AdminServerError, adminGet } from '@/features/painel/server-api';
import { LoadError, PageTitle, StatusBadge } from '@/features/painel/ui';
import { formatPrice } from '@/shared/format';

export const metadata = { title: 'Venda' };

export default async function SaleDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let order: AdminOrderDetail;
  try {
    order = await adminGet<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(code)}`);
  } catch (error) {
    if (error instanceof AdminServerError && error.status === 404) notFound();
    return <LoadError />;
  }
  const a = order.address;
  const street = [a.street, a.number, a.complement].filter(Boolean).join(', ');
  const whatsapp = `https://wa.me/55${order.phone.replace(/\D/g, '')}`;

  return (
    <>
      <Link
        href="/painel/vendas"
        className="inline-flex min-h-12 items-center text-sage-700 underline"
      >
        ← Voltar para as vendas
      </Link>
      <PageTitle>Pedido #{order.publicCode}</PageTitle>
      <StatusBadge status={order.status} />

      <section
        aria-labelledby="entregar"
        className="space-y-2 rounded-card bg-white p-5 shadow-soft"
      >
        <h2 id="entregar" className="font-heading text-2xl text-sage-700">
          Entregar para
        </h2>
        <p className="font-semibold">{order.customerName}</p>
        <p>
          {street}
          <br />
          {a.district} — {a.city}/{a.state}
          <br />
          CEP {formatCep(a.cep)}
        </p>
        <p className="flex flex-wrap gap-3 pt-2">
          <a
            href={`tel:+55${order.phone.replace(/\D/g, '')}`}
            className="inline-flex min-h-12 items-center rounded-full border-2 border-sage-700 px-5 font-semibold text-sage-700"
          >
            Ligar {formatPhone(order.phone)}
          </a>
          <a
            href={whatsapp}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-sage-700 px-5 font-semibold text-sage-700"
          >
            Chamar no WhatsApp
          </a>
        </p>
      </section>

      <section aria-labelledby="itens" className="space-y-2 rounded-card bg-white p-5 shadow-soft">
        <h2 id="itens" className="font-heading text-2xl text-sage-700">
          O que foi comprado
        </h2>
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.productName} className="flex justify-between gap-3">
              <span>
                {item.quantity}x {item.productName}
              </span>
              <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-clay-100 pt-2">
          <span>Frete</span>
          <span>{order.shippingCents === 0 ? 'Grátis' : formatPrice(order.shippingCents)}</span>
        </p>
        <p className="flex justify-between text-xl">
          <strong>Total</strong>
          <strong>{formatPrice(order.totalCents)}</strong>
        </p>
        <p className="text-base">Pedido feito em {formatDateTime(order.createdAt)}.</p>
      </section>

      <OrderActions orderId={order.id} status={order.status} />
    </>
  );
}
