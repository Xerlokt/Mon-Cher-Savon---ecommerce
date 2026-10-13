import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CatalogFilter,
  CatalogQuery,
  IngredientView,
  ProductDetail,
  ProductSummary,
} from '../../domain/ports/index.js';

type ProductWithIngredients = Prisma.ProductGetPayload<{
  include: { ingredients: { include: { ingredient: true } } };
}>;

const toSummary = (p: ProductWithIngredients): ProductSummary => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  priceCents: p.priceCents,
  aroma: p.aroma,
  imageUrl: p.images[0] ?? null,
  soldOut: p.stock <= 0,
});

export class PrismaCatalogQuery implements CatalogQuery {
  constructor(private readonly db: PrismaClient) {}

  async listProducts(filter: CatalogFilter): Promise<ProductSummary[]> {
    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };
    if (filter.aroma) where.aroma = { equals: filter.aroma, mode: 'insensitive' };
    const ingredientWhere: Prisma.IngredientWhereInput = {};
    if (filter.ingredient) ingredientWhere.slug = filter.ingredient;
    if (filter.benefit) ingredientWhere.benefit = { contains: filter.benefit, mode: 'insensitive' };
    if (Object.keys(ingredientWhere).length > 0) {
      where.ingredients = { some: { ingredient: ingredientWhere } };
    }
    const products = await this.db.product.findMany({
      where,
      include: { ingredients: { include: { ingredient: true } } },
      orderBy: { name: 'asc' },
    });
    return products.map(toSummary);
  }

  async getProductBySlug(slug: string): Promise<ProductDetail | null> {
    const p = await this.db.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!p) return null;
    return {
      ...toSummary(p),
      description: p.description,
      usage: p.usage,
      weightGrams: p.weightGrams,
      images: p.images,
      ingredients: p.ingredients.map((pi) => pi.ingredient),
    };
  }

  async listIngredients(): Promise<IngredientView[]> {
    return this.db.ingredient.findMany({ orderBy: { name: 'asc' } });
  }
}
