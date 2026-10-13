import type { AdminOrderSummary } from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { SALES_FILTERS, formatDateTime } from '@/features/painel/labels';
import { OrderActions } from '@/features/painel/order-actions';
import { adminGet } from '@/features/painel/server-api';
import { LoadError, PageTitle, StatusBadge } from '@/features/painel/ui';
import { formatPrice } from '@/shared/format';

export const metadata = { title: 'Vendas' };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao } = await searchParams;
  const filter = SALES_FILTERS.find((f) => f.key === situacao) ?? SALES_FILTERS[0]!;
  let orders: AdminOrderSummary[];
  try {
    orders = await adminGet<AdminOrderSummary[]>(
      `/admin/orders${filter.status ? `?status=${filter.status}` : ''}`,
    );
  } catch {
    return (
      <>
        <PageTitle>Vendas</PageTitle>
        <LoadError />
      </>
    );
  }

  return (
    <>
      <PageTitle>Vendas</PageTitle>
      <nav aria-label="Filtrar vendas">
        <ul className="flex flex-wrap gap-2">
          {SALES_FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={`/painel/vendas?situacao=${f.key}`}
                aria-current={f.key === filter.key ? 'true' : undefined}
                className={`inline-flex min-h-12 items-center rounded-full border px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 ${
                  f.key === filter.key
                    ? 'border-sage-700 bg-sage-700 text-cream-50'
                    : 'border-sage-400 bg-white text-sage-700 hover:bg-clay-100'
                }`}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-card bg-white p-5 shadow-soft">Nenhuma venda aqui.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="space-y-3 rounded-card bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/painel/vendas/${order.publicCode}`}
                  className="font-heading text-xl text-sage-700 underline"
                >
                  {order.customerName}
                </Link>
                <StatusBadge status={order.status} />
              </div>
              <p>
                {order.itemCount} {order.itemCount === 1 ? 'sabonete' : 'sabonetes'} ·{' '}
                <strong>{formatPrice(order.totalCents)}</strong> · {formatDateTime(order.createdAt)}{' '}
                · pedido #{order.publicCode}
              </p>
              <OrderActions orderId={order.id} status={order.status} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
