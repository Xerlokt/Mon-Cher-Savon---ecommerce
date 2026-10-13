import Link from 'next/link';
import { ProductWizard, type IngredientOption } from '@/features/painel/product-wizard';
import { adminGet } from '@/features/painel/server-api';
import { LoadError, PageTitle } from '@/features/painel/ui';

export const metadata = { title: 'Novo sabonete' };

export default async function NewProductPage() {
  let ingredients: IngredientOption[];
  try {
    ingredients = await adminGet<IngredientOption[]>('/ingredients');
  } catch {
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
      <PageTitle>Novo sabonete</PageTitle>
      <ProductWizard ingredients={ingredients} />
    </>
  );
}
