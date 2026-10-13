import Link from 'next/link';
import type { CatalogFilters, Ingredient } from './types';

export function buildCatalogHref(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/catalogo?${query}` : '/catalogo';
}

function Chip({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 ${
        active
          ? 'border-sage-700 bg-sage-700 text-cream-50'
          : 'border-sage-400 bg-cream-50 text-sage-700 hover:bg-clay-100'
      }`}
    >
      {children}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 font-heading text-base text-sage-700">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

interface Props {
  ingredients: Ingredient[];
  aromas: string[];
  active: CatalogFilters;
}

export function FilterBar({ ingredients, aromas, active }: Props) {
  const benefits = [...new Set(ingredients.map((i) => i.benefit))];
  const hasActive = Object.values(active).some(Boolean);
  return (
    <nav aria-label="Filtrar sabonetes" className="space-y-4">
      <Group title="Para a sua pele">
        {benefits.map((b) => (
          <Chip key={b} href={buildCatalogHref({ benefit: b })} active={active.benefit === b}>
            {b}
          </Chip>
        ))}
      </Group>
      <Group title="Aroma">
        {aromas.map((a) => (
          <Chip key={a} href={buildCatalogHref({ aroma: a })} active={active.aroma === a}>
            {a}
          </Chip>
        ))}
      </Group>
      <Group title="Ingrediente">
        {ingredients.map((i) => (
          <Chip
            key={i.id}
            href={buildCatalogHref({ ingredient: i.slug })}
            active={active.ingredient === i.slug}
          >
            {i.name}
          </Chip>
        ))}
      </Group>
      {hasActive ? (
        <Link
          href="/catalogo"
          className="inline-flex min-h-11 items-center text-terracotta-600 underline"
        >
          Limpar filtros
        </Link>
      ) : null}
    </nav>
  );
}
