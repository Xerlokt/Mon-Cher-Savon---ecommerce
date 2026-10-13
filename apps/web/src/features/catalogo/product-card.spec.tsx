import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './product-card';
import type { ProductSummary } from './types';

const product: ProductSummary = {
  id: 'p1',
  slug: 'lavanda',
  name: 'Sabonete de Lavanda',
  priceCents: 1800,
  aroma: 'Floral',
  imageUrl: '/img/sabonete-1.svg',
  soldOut: false,
};

describe('ProductCard', () => {
  it('links to the product page with name and price', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole('link', { name: /Sabonete de Lavanda/ })).toHaveAttribute(
      'href',
      '/produto/lavanda',
    );
    expect(screen.getByText(/R\$\s18,00/)).toBeInTheDocument();
  });

  it('shows the sold-out badge', () => {
    render(<ProductCard product={{ ...product, soldOut: true }} />);
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ProductCard product={product} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
