import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { FilterBar, buildCatalogHref } from './filter-bar';

const ingredients = [
  { id: '1', slug: 'argila-verde', name: 'Argila verde', benefit: 'Pele oleosa' },
  { id: '2', slug: 'manteiga-karite', name: 'Karité', benefit: 'Pele seca' },
  { id: '3', slug: 'aveia', name: 'Aveia', benefit: 'Pele seca' },
];

describe('buildCatalogHref', () => {
  it('builds query strings and omits empty values', () => {
    expect(buildCatalogHref({})).toBe('/catalogo');
    expect(buildCatalogHref({ aroma: 'Floral', benefit: 'Pele seca' })).toBe(
      '/catalogo?aroma=Floral&benefit=Pele+seca',
    );
  });
});

describe('FilterBar', () => {
  it('lists unique benefits, aromas and ingredients as links', () => {
    render(<FilterBar ingredients={ingredients} aromas={['Floral', 'Herbal']} active={{}} />);
    expect(screen.getAllByRole('link', { name: 'Pele seca' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Floral' })).toHaveAttribute(
      'href',
      '/catalogo?aroma=Floral',
    );
    expect(screen.getByRole('link', { name: 'Argila verde' })).toBeInTheDocument();
  });

  it('marks the active filter and offers to clear', () => {
    render(
      <FilterBar ingredients={ingredients} aromas={['Floral']} active={{ aroma: 'Floral' }} />,
    );
    expect(screen.getByRole('link', { name: 'Floral' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Limpar filtros' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <FilterBar ingredients={ingredients} aromas={['Floral']} active={{}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
