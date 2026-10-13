import type { AdminProductView, ProductInput, ProductUpdate } from '@mon-cher-savon/contracts';
import { DomainError } from '../domain/shared/domain-error.js';
import { Product } from '../domain/product/product.js';
import type {
  AdminProductRepository,
  IngredientView,
  ProductReader,
  ProductWriter,
  StockMovementRepository,
  UnitOfWork,
} from '../domain/ports/index.js';

export class ProductNotFoundForAdminError extends DomainError {
  constructor() {
    super('Sabonete não encontrado.');
  }
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'sabonete';
  let candidate = root;
  for (let n = 2; await exists(candidate); n++) candidate = `${root}-${n}`;
  return candidate;
}

export class CreateProductUseCase {
  constructor(
    private readonly products: AdminProductRepository,
    private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: ProductInput): Promise<AdminProductView> {
    // Run the domain invariants (name, price, stock) before touching the database.
    Product.create({
      id: 'new',
      slug: 'new',
      name: input.name,
      priceCents: input.priceCents,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
    });
    const slug = await uniqueSlug(input.name, (s) => this.products.slugExists(s));
    const created = await this.products.create({ ...input, name: input.name.trim(), slug });
    if (input.stock > 0) {
      await this.movements.record({ productId: created.id, delta: input.stock, reason: 'RESTOCK' });
    }
    return created;
  }
}

export class UpdateProductUseCase {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(id: string, patch: ProductUpdate): Promise<AdminProductView> {
    if (patch.name !== undefined && patch.name.trim() === '') {
      throw new DomainError('Nome do sabonete é obrigatório');
    }
    const updated = await this.products.update(id, patch);
    if (!updated) throw new ProductNotFoundForAdminError();
    return updated;
  }
}

export class ArchiveProductUseCase {
  constructor(private readonly products: AdminProductRepository) {}

  /** "Excluir" never deletes: the product leaves the store but stays in reports. */
  async execute(id: string): Promise<void> {
    if (!(await this.products.setStatus(id, 'ARCHIVED'))) throw new ProductNotFoundForAdminError();
  }
}

export class RestoreProductUseCase {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(id: string): Promise<void> {
    if (!(await this.products.setStatus(id, 'ACTIVE'))) throw new ProductNotFoundForAdminError();
  }
}

export class CreateIngredientUseCase {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(input: { name: string; benefit: string }): Promise<IngredientView> {
    const slug = await uniqueSlug(input.name, (s) => this.products.slugExistsIngredient(s));
    return this.products.createIngredient({
      name: input.name.trim(),
      benefit: input.benefit,
      slug,
    });
  }
}

export class AdjustStockUseCase {
  constructor(
    private readonly reader: ProductReader,
    private readonly writer: ProductWriter,
    private readonly movements: StockMovementRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Returns the new stock. Rows are locked so the adjustment cannot race with a sale. */
  async execute(
    productId: string,
    adjustment: { delta: number; reason: 'RESTOCK' | 'ADJUSTMENT' },
  ): Promise<number> {
    return this.unitOfWork.run(async () => {
      const [product] = await this.reader.findByIds([productId]);
      if (!product) throw new ProductNotFoundForAdminError();
      if (adjustment.delta > 0) product.increaseStock(adjustment.delta);
      else product.decreaseStock(-adjustment.delta);
      await this.writer.save(product);
      await this.movements.record({
        productId,
        delta: adjustment.delta,
        reason: adjustment.reason,
      });
      return product.stock;
    });
  }
}
