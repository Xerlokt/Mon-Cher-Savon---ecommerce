import { DomainError } from '../domain/shared/domain-error.js';
import type {
  CatalogFilter,
  CatalogQuery,
  IngredientView,
  ProductDetail,
  ProductSummary,
} from '../domain/ports/index.js';

export class ProductNotFoundError extends DomainError {
  constructor(slug: string) {
    super(`Produto ${slug} não encontrado`);
  }
}

export class BrowseCatalogUseCase {
  constructor(private readonly catalog: CatalogQuery) {}

  list(filter: CatalogFilter): Promise<ProductSummary[]> {
    return this.catalog.listProducts(filter);
  }

  async detail(slug: string): Promise<ProductDetail> {
    const product = await this.catalog.getProductBySlug(slug);
    if (!product) throw new ProductNotFoundError(slug);
    return product;
  }

  ingredients(): Promise<IngredientView[]> {
    return this.catalog.listIngredients();
  }
}
