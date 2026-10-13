import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain/shared/domain-error.js';
import type { CatalogQuery, ProductDetail, ProductSummary } from '../domain/ports/index.js';
import { BrowseCatalogUseCase } from './browse-catalog.use-case.js';

const summary: ProductSummary = {
  id: 'p1',
  slug: 'lavanda',
  name: 'Lavanda',
  priceCents: 1800,
  aroma: 'floral',
  imageUrl: null,
  soldOut: false,
};
const detail: ProductDetail = {
  ...summary,
  description: 'd',
  usage: 'u',
  weightGrams: 100,
  images: [],
  ingredients: [],
};

class FakeCatalog implements CatalogQuery {
  lastFilter: unknown;
  async listProducts(filter: object) {
    this.lastFilter = filter;
    return [summary];
  }
  async getProductBySlug(slug: string) {
    return slug === 'lavanda' ? detail : null;
  }
  async listIngredients() {
    return [{ id: 'i1', slug: 'argila', name: 'Argila', benefit: 'pele oleosa' }];
  }
}

describe('BrowseCatalogUseCase', () => {
  it('lists products passing filters through', async () => {
    const catalog = new FakeCatalog();
    const result = await new BrowseCatalogUseCase(catalog).list({ aroma: 'floral' });
    expect(result).toEqual([summary]);
    expect(catalog.lastFilter).toEqual({ aroma: 'floral' });
  });
  it('returns a product by slug', async () => {
    expect(await new BrowseCatalogUseCase(new FakeCatalog()).detail('lavanda')).toEqual(detail);
  });
  it('fails for an unknown slug', async () => {
    await expect(new BrowseCatalogUseCase(new FakeCatalog()).detail('x')).rejects.toBeInstanceOf(
      DomainError,
    );
  });
  it('lists ingredients', async () => {
    expect(await new BrowseCatalogUseCase(new FakeCatalog()).ingredients()).toHaveLength(1);
  });
});
