import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AddToCartButton } from '@/features/carrinho/add-to-cart-button';
import { getProduct } from '@/features/catalogo/api';
import { formatPrice } from '@/shared/format';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: 'Produto não encontrado' };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: product.imageUrl ? { images: [product.imageUrl] } : {},
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const siteUrl = process.env['SITE_URL'] ?? 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((src) => new URL(src, siteUrl).toString()),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: (product.priceCents / 100).toFixed(2),
      availability: product.soldOut
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    },
  };

  return (
    <article className="grid gap-8 md:grid-cols-2">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="space-y-3">
        {product.images.map((src, i) => (
          <div
            key={src}
            className="relative aspect-square overflow-hidden rounded-card bg-clay-100"
          >
            <Image
              src={src}
              alt={i === 0 ? product.name : ''}
              fill
              priority={i === 0}
              unoptimized={src.endsWith('.svg') || src.startsWith('/uploads')}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl text-sage-700">{product.name}</h1>
          <p className="mt-2 text-2xl font-bold text-terracotta-600">
            {formatPrice(product.priceCents)}
          </p>
          <p className="text-sm">
            {product.weightGrams} g · aroma {product.aroma.toLowerCase()}
          </p>
        </header>
        {product.soldOut ? (
          <p
            role="status"
            className="inline-block rounded-full bg-ink-900 px-4 py-2 font-semibold text-cream-50"
          >
            Esgotado
          </p>
        ) : null}
        <AddToCartButton
          soldOut={product.soldOut}
          product={{
            productId: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
          }}
        />
        <section aria-labelledby="descricao">
          <h2 id="descricao" className="text-xl text-sage-700">
            Sobre este sabonete
          </h2>
          <p className="mt-2">{product.description}</p>
        </section>
        <section aria-labelledby="ingredientes">
          <h2 id="ingredientes" className="text-xl text-sage-700">
            Ingredientes
          </h2>
          <ul className="mt-2 list-disc pl-5">
            {product.ingredients.map((i) => (
              <li key={i.id}>
                {i.name} <span className="text-sm">({i.benefit.toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="uso">
          <h2 id="uso" className="text-xl text-sage-700">
            Modo de uso
          </h2>
          <p className="mt-2">{product.usage}</p>
        </section>
      </div>
    </article>
  );
}
