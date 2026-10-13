import type { AdminOrderSummary, AdminProductView } from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { OrderActions } from '@/features/painel/order-actions';
import { adminGet } from '@/features/painel/server-api';
import { StockStepper } from '@/features/painel/stock-stepper';
import { LoadError, PageTitle, PanelCard } from '@/features/painel/ui';
import { formatPrice } from '@/shared/format';

export const metadata = { title: 'Início' };

export default async function PainelHome() {
  let toShip: AdminOrderSummary[];
  let products: AdminProductView[];
  try {
    [toShip, products] = await Promise.all([
      adminGet<AdminOrderSummary[]>('/admin/orders?status=PAID'),
      adminGet<AdminProductView[]>('/admin/products'),
    ]);
  } catch {
    return (
      <>
        <PageTitle>Início</PageTitle>
        <LoadError />
      </>
    );
  }
  const running = products.filter((p) => p.status === 'ACTIVE' && p.lowStock);

  return (
    <>
      <PageTitle>Olá! Veja como está a loja</PageTitle>

      <PanelCard
        id="enviar"
        title="O que preciso enviar?"
        help="São as vendas já pagas que ainda não foram enviadas. Depois de postar, toque em Marquei como enviado."
      >
        {toShip.length === 0 ? (
          <p>Tudo enviado! Nenhuma venda esperando por você.</p>
        ) : (
          <ul className="space-y-4">
            {toShip.map((order) => (
              <li key={order.id} className="space-y-3 rounded-card bg-clay-100 p-4">
                <div className="flex justify-between gap-3">
                  <Link
                    href={`/painel/vendas/${order.publicCode}`}
                    className="font-semibold text-sage-700 underline"
                  >
                    {order.customerName}
                  </Link>
                  <span className="font-bold text-terracotta-600">
                    {formatPrice(order.totalCents)}
                  </span>
                </div>
                <p>
                  {order.itemCount} {order.itemCount === 1 ? 'sabonete' : 'sabonetes'} · pedido #
                  {order.publicCode}
                </p>
                <OrderActions orderId={order.id} status={order.status} compact />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        id="acabando"
        title="O que está acabando?"
        help="Sabonetes com poucas unidades. Use + para dizer que fez mais."
      >
        {running.length === 0 ? (
          <p>Nada acabando por enquanto.</p>
        ) : (
          <ul className="space-y-4">
            {running.map((product) => (
              <li key={product.id} className="space-y-2 rounded-card bg-clay-100 p-4">
                <p className="font-semibold text-sage-700">{product.name}</p>
                <p>
                  {product.stock === 0 ? 'Esgotado — repor agora' : `Restam só ${product.stock}`}
                </p>
                <StockStepper
                  productId={product.id}
                  name={product.name}
                  initialStock={product.stock}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </>
  );
}
