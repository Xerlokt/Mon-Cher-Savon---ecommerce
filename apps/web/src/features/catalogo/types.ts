export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  aroma: string;
  imageUrl: string | null;
  soldOut: boolean;
}

export interface Ingredient {
  id: string;
  slug: string;
  name: string;
  benefit: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  usage: string;
  weightGrams: number;
  images: string[];
  ingredients: Ingredient[];
}

export interface CatalogFilters {
  ingredient?: string;
  aroma?: string;
  benefit?: string;
}
