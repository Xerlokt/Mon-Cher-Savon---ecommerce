import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'A artesã',
  description: 'Conheça a história por trás dos sabonetes artesanais da Mon Cher Savon.',
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
      <h1 className="text-3xl text-sage-700">A artesã por trás dos sabonetes</h1>
      <p>
        A Mon Cher Savon nasceu da vontade de transformar ingredientes simples — ervas, argilas,
        manteigas vegetais e óleos essenciais — em sabonetes que cuidam da pele e perfumam o banho.
      </p>
      <p>
        Cada lote é feito à mão, em pequenas quantidades, com receitas testadas e ingredientes
        escolhidos um a um. Por isso você encontra, em cada sabonete, a lista completa do que ele
        leva e para que serve.
      </p>
      <p>
        Gostou? Veja os{' '}
        <Link href="/catalogo" className="text-terracotta-600 underline">
          sabonetes disponíveis
        </Link>
        .
      </p>
    </article>
  );
}
