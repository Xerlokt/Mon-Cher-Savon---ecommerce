import Link from 'next/link';
import { listIngredients, listProducts } from '@/features/catalogo/api';
import { buildCatalogHref } from '@/features/catalogo/filter-bar';
import { ProductCard } from '@/features/catalogo/product-card';

export default async function HomePage() {
  const [products, ingredients] = await Promise.all([listProducts(), listIngredients()]);
  const benefits = [...new Set(ingredients.map((i) => i.benefit))];
  return (
    <div className="space-y-12">
      <section className="rounded-card bg-clay-100 px-6 py-12 text-center shadow-soft">
        <h1 className="text-4xl text-sage-700 md:text-5xl">Sabonetes feitos à mão, com cuidado</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg">
          Ingredientes naturais, pequenos lotes e aromas que lembram um jardim.
        </p>
        <Link
          href="/catalogo"
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-terracotta-600 px-8 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
        >
          Ver sabonetes
        </Link>
      </section>

      {benefits.length > 0 ? (
        <section aria-labelledby="beneficio">
          <h2 id="beneficio" className="mb-4 text-2xl text-sage-700">
            Compre pelo que a sua pele precisa
          </h2>
          <ul className="flex flex-wrap gap-3">
            {benefits.map((b) => (
              <li key={b}>
                <Link
                  href={buildCatalogHref({ benefit: b })}
                  className="inline-flex min-h-12 items-center rounded-full border border-sage-400 bg-cream-50 px-5 text-sage-700 hover:bg-clay-100"
                >
                  {b}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="destaques">
        <h2 id="destaques" className="mb-4 text-2xl text-sage-700">
          Destaques
        </h2>
        {products.length === 0 ? (
          <p>Estamos preparando os sabonetes. Volte em instantes.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
