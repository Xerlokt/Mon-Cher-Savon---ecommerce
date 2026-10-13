import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/shared/format';
import type { ProductSummary } from './types';

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="group relative overflow-hidden rounded-card bg-clay-100 shadow-soft">
      <div className="relative aspect-square bg-cream-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            unoptimized={
              product.imageUrl.endsWith('.svg') || product.imageUrl.startsWith('/uploads')
            }
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : null}
        {product.soldOut ? (
          <span className="absolute left-3 top-3 rounded-full bg-ink-900 px-3 py-1 text-sm font-semibold text-cream-50">
            Esgotado
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-heading text-lg text-sage-700">
          <Link
            href={`/produto/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
          >
            {product.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-900">{product.aroma}</p>
        <p className="text-lg font-bold text-terracotta-600">{formatPrice(product.priceCents)}</p>
      </div>
    </article>
  );
}
