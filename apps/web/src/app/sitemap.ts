import type { MetadataRoute } from 'next';
import { listProducts } from '@/features/catalogo/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env['SITE_URL'] ?? 'http://localhost:3000';
  const products = await listProducts();
  return [
    { url: base, changeFrequency: 'weekly' },
    { url: `${base}/catalogo`, changeFrequency: 'weekly' },
    ...products.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      changeFrequency: 'weekly' as const,
    })),
  ];
}
