import type { Metadata } from 'next';
import { CONTACT_EMAIL, LegalPage } from '@/features/institucional/legal-page';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como a Mon Cher Savon trata os seus dados pessoais, conforme a LGPD.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updated="outubro de 2026">
      <p>
        A Mon Cher Savon respeita a sua privacidade e trata os seus dados conforme a Lei Geral de
        Proteção de Dados (LGPD, Lei 13.709/2018). Coletamos só o necessário para entregar o seu
        pedido.
      </p>

      <h2>Quais dados coletamos</h2>
      <ul>
        <li>Nome, WhatsApp e e-mail, para falar sobre o seu pedido.</li>
        <li>Endereço de entrega (CEP, rua, número, bairro, cidade e UF).</li>
        <li>Os itens, o valor e a situação de cada pedido.</li>
      </ul>
      <p>
        <strong>Não guardamos dados de cartão.</strong> O pagamento é feito no Mercado Pago, que
        trata esses dados com a própria política dele.
      </p>

      <h2>Para que usamos</h2>
      <ul>
        <li>Receber o pagamento e confirmar o pedido.</li>
        <li>Separar, embalar e entregar os sabonetes.</li>
        <li>Avisar a artesã de cada venda, com os itens e o endereço de entrega.</li>
        <li>Cumprir obrigações legais e fiscais.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>Mercado Pago, para processar o pagamento.</li>
        <li>Transportadora ou Correios, apenas com o necessário para entregar.</li>
        <li>Telegram ou WhatsApp, somente para avisar a artesã sobre a venda.</li>
      </ul>
      <p>Não vendemos os seus dados e não os usamos para propaganda de terceiros.</p>

      <h2>Cookies e armazenamento no aparelho</h2>
      <p>
        Usamos o armazenamento do seu navegador apenas para guardar o carrinho. Não usamos
        rastreadores de publicidade.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Pelo tempo necessário para cumprir a entrega, a garantia e as obrigações legais. Depois
        disso, apagamos ou anonimizamos os dados.
      </p>

      <h2>Os seus direitos</h2>
      <p>
        Você pode pedir a qualquer momento: confirmação de que tratamos os seus dados, acesso,
        correção, anonimização ou exclusão, portabilidade e informação sobre com quem
        compartilhamos. Escreva para{' '}
        <a className="text-terracotta-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
