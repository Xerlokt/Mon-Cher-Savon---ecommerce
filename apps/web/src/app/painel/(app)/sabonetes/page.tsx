import type { AdminProductView } from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { PutBackButton, RemoveFromStoreButton } from '@/features/painel/product-visibility-buttons';
import { adminGet } from '@/features/painel/server-api';
import { StockStepper } from '@/features/painel/stock-stepper';
import { LoadError, PageTitle } from '@/features/painel/ui';
import { formatPrice } from '@/shared/format';

export const metadata = { title: 'Meus sabonetes' };

export default async function ProductsPage() {
  let products: AdminProductView[];
  try {
    products = await adminGet<AdminProductView[]>('/admin/products');
  } catch {
    return (
      <>
        <PageTitle>Meus sabonetes</PageTitle>
        <LoadError />
      </>
    );
  }
  const active = products.filter((p) => p.status === 'ACTIVE');
  const archived = products.filter((p) => p.status === 'ARCHIVED');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Meus sabonetes</PageTitle>
        <Link
          href="/painel/sabonetes/novo"
          className="inline-flex min-h-14 items-center rounded-full bg-terracotta-600 px-6 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
        >
          Novo sabonete
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="rounded-card bg-white p-5 shadow-soft">
          Você ainda não tem sabonetes na loja. Toque em <strong>Novo sabonete</strong>.
        </p>
      ) : (
        <ul className="space-y-4">
          {active.map((p) => (
            <li key={p.id} className="space-y-4 rounded-card bg-white p-5 shadow-soft">
              <div className="flex gap-4">
                {p.images[0] ? (
                  <img
                    src={p.images[0]}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <h2 className="font-heading text-xl text-sage-700">{p.name}</h2>
                  <p className="font-bold text-terracotta-600">{formatPrice(p.priceCents)}</p>
                  {p.lowStock ? (
                    <p className="mt-1 inline-block rounded-full bg-warning/15 px-3 py-1 text-base font-semibold text-warning">
                      {p.stock === 0 ? 'Esgotado' : 'Está acabando'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold">Quantos tenho</p>
                <StockStepper productId={p.id} name={p.name} initialStock={p.stock} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/painel/sabonetes/${p.id}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-sage-700 px-5 text-lg font-semibold text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
                >
                  Editar sabonete
                </Link>
                <RemoveFromStoreButton productId={p.id} name={p.name} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <section aria-labelledby="fora" className="space-y-3">
          <h2 id="fora" className="font-heading text-2xl text-sage-700">
            Fora da loja
          </h2>
          <ul className="space-y-3">
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-clay-100 p-4"
              >
                <span>{p.name}</span>
                <PutBackButton productId={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
