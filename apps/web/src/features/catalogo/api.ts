import type { CatalogFilters, Ingredient, ProductDetail, ProductSummary } from './types';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listProducts(filters: CatalogFilters = {}): Promise<ProductSummary[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return (await get<ProductSummary[]>(`/products${query ? `?${query}` : ''}`)) ?? [];
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  return get<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
}

export async function listIngredients(): Promise<Ingredient[]> {
  return (await get<Ingredient[]>('/ingredients')) ?? [];
}
