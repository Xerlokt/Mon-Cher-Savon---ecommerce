import type { Metadata } from 'next';
import { CONTACT_EMAIL, LegalPage } from '@/features/institucional/legal-page';

export const metadata: Metadata = {
  title: 'Trocas e devoluções',
  description: 'Como funcionam trocas, devoluções e arrependimento de compra na Mon Cher Savon.',
};

export default function ReturnsPage() {
  return (
    <LegalPage title="Trocas e devoluções" updated="outubro de 2026">
      <h2>Arrependimento</h2>
      <p>
        Como a compra é feita pela internet, você pode desistir em até <strong>7 dias</strong>{' '}
        depois de receber o pedido (Código de Defesa do Consumidor, art. 49). Para sabonetes,
        aceitamos a devolução de produtos fechados e sem uso, e devolvemos o valor pago.
      </p>

      <h2>Produto com defeito ou erro no pedido</h2>
      <p>
        Chegou quebrado, derretido ou diferente do que você comprou? Fale com a gente em até 7 dias
        com uma foto. Enviamos outro sabonete ou devolvemos o valor, como você preferir.
      </p>

      <h2>Como pedir</h2>
      <ul>
        <li>
          Escreva para{' '}
          <a className="text-terracotta-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{' '}
          com o número do pedido (aquele de 6 letras, por exemplo A7K2QX).
        </li>
        <li>
          Combinamos juntos o envio de volta. Quando o defeito é nosso, o frete é por nossa conta.
        </li>
        <li>O reembolso é feito pela mesma forma de pagamento (Pix ou cartão).</li>
      </ul>

      <h2>Cuidados com o sabonete artesanal</h2>
      <p>
        Sabonetes feitos à mão podem ter pequenas diferenças de cor e formato: isso faz parte do
        artesanal e não é defeito. Para durarem mais, deixe-os secar em uma saboneteira com
        furinhos.
      </p>
    </LegalPage>
  );
}
