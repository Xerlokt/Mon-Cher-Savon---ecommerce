import type { AdminProductView } from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductWizard, type IngredientOption } from '@/features/painel/product-wizard';
import { AdminServerError, adminGet } from '@/features/painel/server-api';
import { LoadError, PageTitle } from '@/features/painel/ui';

export const metadata = { title: 'Editar sabonete' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product: AdminProductView;
  let ingredients: IngredientOption[];
  try {
    [product, ingredients] = await Promise.all([
      adminGet<AdminProductView>(`/admin/products/${encodeURIComponent(id)}`),
      adminGet<IngredientOption[]>('/ingredients'),
    ]);
  } catch (error) {
    if (error instanceof AdminServerError && error.status === 404) notFound();
    return <LoadError />;
  }
  return (
    <>
      <Link
        href="/painel/sabonetes"
        className="inline-flex min-h-12 items-center text-sage-700 underline"
      >
        ← Voltar para meus sabonetes
      </Link>
      <PageTitle>Editar {product.name}</PageTitle>
      <ProductWizard ingredients={ingredients} product={product} />
    </>
  );
}
