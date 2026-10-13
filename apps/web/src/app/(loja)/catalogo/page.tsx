import type { Metadata } from 'next';
import { listIngredients, listProducts } from '@/features/catalogo/api';
import { FilterBar } from '@/features/catalogo/filter-bar';
import { ProductCard } from '@/features/catalogo/product-card';
import type { CatalogFilters } from '@/features/catalogo/types';

export const metadata: Metadata = {
  title: 'Sabonetes artesanais',
  description:
    'Todos os sabonetes artesanais da Mon Cher Savon. Filtre por ingrediente, aroma ou benefício.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const active: CatalogFilters = {};
  const ingredient = first(sp['ingredient']);
  const aroma = first(sp['aroma']);
  const benefit = first(sp['benefit']);
  if (ingredient) active.ingredient = ingredient;
  if (aroma) active.aroma = aroma;
  if (benefit) active.benefit = benefit;

  const [products, all, ingredients] = await Promise.all([
    listProducts(active),
    listProducts(),
    listIngredients(),
  ]);
  const aromas = [...new Set(all.map((p) => p.aroma).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-sage-700">Sabonetes</h1>
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside>
          <FilterBar ingredients={ingredients} aromas={aromas} active={active} />
        </aside>
        <section aria-label="Lista de sabonetes">
          {products.length === 0 ? (
            <p>Nenhum sabonete encontrado com esses filtros.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 2} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
