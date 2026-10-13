import Link from 'next/link';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
      <h1 className="text-3xl text-sage-700">{title}</h1>
      {updated ? <p className="text-sm">Atualizado em {updated}</p> : null}
      <div className="space-y-4 [&_h2]:mt-6 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:text-sage-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p>
        <Link href="/" className="inline-flex min-h-11 items-center text-terracotta-600 underline">
          Voltar para a loja
        </Link>
      </p>
    </article>
  );
}

export const CONTACT_EMAIL =
  process.env['NEXT_PUBLIC_CONTACT_EMAIL'] ?? 'contato@moncheravon.example';
