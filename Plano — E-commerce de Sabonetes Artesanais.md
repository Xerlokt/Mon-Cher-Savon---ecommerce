# Plano — E-commerce de Sabonetes Artesanais

Oct 13, 2026 · @Gian Carlo

## Status atual e próximos passos (atualizado em 13/10/2026)

**Nome da loja: Mon Cher Savon** (o nome provisório "sabonetaria" foi trocado em todo o projeto).

**Etapas 0 a 7 do código estão feitas.** Monorepo `pnpm` + Turborepo, API NestJS (Clean Architecture), web Next.js (vitrine + `/painel`), contratos Zod, tokens de design. Verificado: 174 testes unitários na API (98% de cobertura em domínio e aplicação), 129 no web, 22 de integração com Postgres real, 24 E2E com Playwright (celular e desktop, com axe) e Lighthouse (celular, 4G simulado) com desempenho 96–99, acessibilidade 100, SEO 100 e LCP em torno de 2,0 s.

Onde achar as coisas: `README.md` (rodar e testar), `docs/deploy.md`, `docs/launch-checklist.md`, `docs/notifications.md`, `docs/adr/0001–0005`, `.github/workflows/` (CI, deploy, reset da demo), `e2e/` (Playwright + Lighthouse + mocks locais).

### Como retomar
1. `pnpm install` (se aparecer `EPERM` no `prisma generate`, feche servidores `node` abertos e rode `pnpm --filter @mon-cher-savon/api exec prisma generate`).
2. `docker compose up -d`, copie `.env.example` para `.env` (precisa de `SESSION_SECRET` com 32+ caracteres; use `PAYMENT_MODE=fake` para ver a interface sem credenciais).
3. `pnpm --filter @mon-cher-savon/api db:deploy && ... db:seed` e crie a vendedora com `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @mon-cher-savon/api db:seed-admin`.
4. `pnpm dev` (web :3000, API :3001). Testes: `pnpm test:cov`, `pnpm --filter @mon-cher-savon/api test:int`, `pnpm --filter @mon-cher-savon/e2e test`, `... lighthouse`.

Regras que valem para a próxima sessão: commits convencionais com assunto em minúsculas (o commitlint recusa o resto), TDD (teste primeiro), nenhum segredo no Git, nenhum teste chama serviço real. O Prisma bloqueia `migrate reset` quando rodado por IA: não contornar, pedir consentimento ao usuário. O banco de E2E (`mon_cher_savon_e2e`) é só dele e o script recusa qualquer outro.

### O que falta (em ordem sugerida)
**Código que dá para fazer na próxima sessão**
1. ~~**Fotos em produção**~~ **Feito (14/10/2026):** `CloudinaryImageStorage` (upload assinado) atrás da porta `ImageStorage`; ative com `IMAGE_STORAGE=cloudinary` + `CLOUDINARY_*`. Falta só testar com uma conta Cloudinary real.
2. **Pagamento no cartão na tela: código feito (14/10/2026), falta validar no sandbox.** Opção "Cartão de crédito" (MercadoPago.js Secure Fields, só o token vai para a API; cartão recusado cancela o pedido e mostra o motivo). Liga com `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`; sem a chave a loja é só Pix. **Falta (precisa de credenciais de sandbox):** conferir a API do SDK e a lista de origens da CSP (`next.config.mjs`) com um cartão de teste, e parcelamento (hoje 1x).
3. **Teste contra o sandbox real do Mercado Pago** (hoje o adaptador só foi testado com HTTP simulado) e contra um bot real do Telegram.
4. **Screenshots do README: feito (14/10/2026)** (4 imagens em `docs/screenshots`, geradas pelo spec `04-screenshots`). **Banner feito** (`docs/banner.svg`). **Falta:** GIF do fluxo de compra e o protótipo no Figma validado com a vendedora.
5. **Imagem Docker da API: feito (14/10/2026)**, de 1,05 GB para 777 MB (`pnpm deploy --prod`, só dependências de produção, Prisma gerado no build; a migração roda com `node_modules/.bin/prisma migrate deploy`, já ajustado no `render.yaml`). O resto é a base do Node e o Prisma. **Falta:** se houver mais de uma instância, trocar os limites de login e de pedidos (hoje em memória) por um armazenamento compartilhado.
6. **Dashboard com datas livres e reembolso pelo painel: feito (14/10/2026).** Botão "Escolher datas" (até 1 ano) e botão "Devolver o dinheiro" (reembolso total, nova situação `REFUNDED`, migração `order_refunded`; estoque só volta se ainda não foi enviado). **Falta:** testar um reembolso real no sandbox do Mercado Pago; reembolso parcial segue manual.

**Depende de uma pessoa** (lista completa em `docs/launch-checklist.md`)
- Contas e deploy: Mercado Pago de produção, bot do Telegram, Vercel, Render, banco (Neon/Supabase), domínio `.com.br`; variáveis `DEPLOY_ENABLED` e secrets do GitHub.
- GitHub: branch `main` protegida (PR + CI verde), secret scanning e push protection, relatório privado de vulnerabilidade; trocar `OWNER` no badge do README.
- Revisão jurídica das políticas de privacidade e de trocas (são rascunhos); textos e fotos reais da vendedora; `NEXT_PUBLIC_CONTACT_EMAIL` real.
- **Teste de usabilidade com a vendedora** (3 tarefas cronometradas: cadastrar um sabonete, marcar uma venda como enviada, descobrir o mais vendido) e ajustes do que travar.
- Primeira venda real de ponta a ponta (Pix) e rotação de todos os tokens usados nos testes.

---

## Visão geral

Uma loja online de sabonetes artesanais com duas áreas: a vitrine para clientes e um painel simples para a vendedora, que recebe um aviso no Telegram ou WhatsApp a cada venda. Como o repositório será público e serve de portfólio, código, testes e documentação seguem o padrão de um time profissional.

**Personas**

- **Cliente**: navega quase sempre pelo celular, quer ver fotos e ingredientes e pagar rápido, de preferência com Pix.
- **Vendedora**: pouca familiaridade com tecnologia. Precisa saber em segundos o que vendeu, o que enviar e o que repor.

**Escopo do MVP**

- Vitrine: catálogo, página do produto, carrinho, checkout sem cadastro, pagamento Pix/cartão e página de status do pedido.
- Painel: vendas, produtos (criar, editar, estoque, excluir) e dashboard de vendas e ingredientes.
- Aviso de nova venda com itens, quantidades e endereço de entrega.

**Fora do MVP** (backlog): cupons, frete por transportadora, conta de cliente com login, várias vendedoras e emissão de nota fiscal. O nome do projeto usado aqui (sabonetaria) é provisório.

## Requisitos

Quinze requisitos funcionais cobrem o MVP; cada um vira uma ou mais histórias no board do GitHub Projects.

| ID | Requisito | Área |
| --- | --- | --- |
| RF01 | Listar produtos com foto, nome, preço e selo de esgotado | Vitrine |
| RF02 | Filtrar por ingrediente, aroma ou benefício (pele seca, oleosa) | Vitrine |
| RF03 | Página do produto com fotos, descrição, ingredientes, peso e modo de uso | Vitrine |
| RF04 | Carrinho salvo no navegador, sem login | Vitrine |
| RF05 | Checkout com nome, WhatsApp, e-mail e endereço preenchido pelo CEP | Vitrine |
| RF06 | Pagamento Pix e cartão; pedido só vira pago após confirmação do provedor | Vitrine |
| RF07 | Página de status do pedido acessada por código único | Vitrine |
| RF08 | Login da vendedora com opção lembrar de mim | Painel |
| RF09 | Lista de vendas por situação e troca de situação com um toque | Painel |
| RF10 | Criar, editar e excluir produto (exclusão arquiva, preserva o histórico) | Painel |
| RF11 | Ajustar estoque com botões + e −, registrando o motivo | Painel |
| RF12 | Dashboard: faturamento, nº de vendas, valor médio, mais vendidos, ingredientes mais comprados, estoque baixo | Painel |
| RF13 | Aviso de venda paga com itens, quantidades, total e endereço | Notificação |
| RF14 | Escolher canal (Telegram/WhatsApp) e enviar mensagem de teste pelo painel | Notificação |
| RF15 | Baixa automática de estoque ao confirmar pagamento, sem vender além do disponível | Estoque |

**Não funcionais**

- Responsivo mobile-first, de 360 px a telas largas.
- Acessibilidade WCAG 2.2 AA: contraste, foco visível, alvos de toque com pelo menos 44 px.
- Performance: LCP abaixo de 2,5 s em 4G, imagens otimizadas e lazy loading.
- Segurança alinhada ao OWASP Top 10 e à LGPD (dados mínimos, política de privacidade).
- Qualidade: cobertura de pelo menos 90% em domínio e aplicação; CI bloqueia merge com falha.
- SEO: metadados por produto, sitemap e schema.org Product.

## Stack técnica

TypeScript de ponta a ponta, em monorepo: um só ecossistema de tipos e testes, e contratos compartilhados entre front e back. Python (FastAPI) também serviria; TypeScript foi escolhido para aproveitar seu React e mostrar domínio de uma stack completa.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Separa apps e pacotes, com cache de build no CI |
| Front-end | Next.js (App Router) + React | SSR/SSG para SEO da vitrine e otimização de imagens |
| Estilo | Tailwind CSS + Radix UI | Design system próprio com componentes acessíveis |
| Back-end | NestJS | Módulos e injeção de dependência combinam com Clean Architecture |
| Banco | PostgreSQL | Relacional, agregações do dashboard direto em SQL |
| ORM | Prisma | Migrations versionadas; fica só na camada de infraestrutura |
| Validação | Zod | Mesmos schemas no formulário e na API |
| Pagamento | Mercado Pago | Pix e cartão, sandbox gratuito, popular no Brasil |
| Avisos | Telegram Bot API e WhatsApp Cloud API | Canais oficiais, trocáveis por Strategy |
| Fila | Outbox no Postgres + worker | Avisos confiáveis sem depender de Redis no MVP |
| Imagens | Cloudinary ou Cloudflare R2 | Upload assinado e redimensionamento |
| Testes | Vitest, Testing Library, Supertest, Testcontainers, MSW, Playwright | Cobrem da regra de negócio ao fluxo E2E |
| Qualidade | ESLint, Prettier, Husky, lint-staged, commitlint | Padrão garantido antes do commit |
| Local | Docker Compose | Postgres e API sobem com um comando |

## Arquitetura

Clean Architecture (hexagonal) na API: as regras de negócio não conhecem NestJS, Prisma, Mercado Pago nem Telegram. As dependências apontam para dentro, e cada serviço externo entra por um adaptador que implementa uma porta do domínio.

&#91;embedded content: camadas da API · domínio no centro\]

A web chama a API por HTTP; cada camada só conhece a de dentro, e a infraestrutura implementa as portas que o domínio define.

No front-end, uma única app Next.js serve a vitrine e o painel (/painel, protegido por middleware), organizada por features. Eventos de domínio (OrderPaid) desacoplam o pagamento da baixa de estoque e dos avisos.

```text
sabonetaria/
├─ apps/
│  ├─ web/                    # Next.js: vitrine + /painel
│  │  └─ src/
│  │     ├─ app/(loja)/       # rotas públicas
│  │     ├─ app/painel/       # rotas da vendedora
│  │     ├─ features/         # catalogo, carrinho, checkout, vendas, dashboard
│  │     └─ shared/ui/        # design system botânico
│  └─ api/                    # NestJS
│     └─ src/
│        ├─ domain/           # entidades, value objects, eventos, portas
│        ├─ application/      # casos de uso (1 classe = 1 ação)
│        ├─ infrastructure/   # Prisma, Mercado Pago, Telegram, WhatsApp, storage
│        └─ presentation/     # controllers, DTOs, guards
├─ packages/
│  ├─ contracts/              # schemas Zod e tipos compartilhados
│  ├─ ui-tokens/              # cores, fontes, espaçamentos
│  └─ config/                 # eslint, tsconfig, vitest base
├─ e2e/                       # Playwright
├─ docs/adr/                  # decisões de arquitetura
└─ docker-compose.yml
```

**SOLID no código**

| Princípio | Onde aparece |
| --- | --- |
| S — Responsabilidade única | Cada caso de uso faz uma coisa: CreateOrder, ConfirmPayment, AdjustStock |
| O — Aberto/fechado | Novo canal de aviso = nova classe NotificationChannel, sem alterar as existentes |
| L — Substituição de Liskov | Qualquer PaymentGateway (Mercado Pago ou fake de teste) roda o mesmo caso de uso |
| I — Segregação de interfaces | ProductReader e ProductWriter separados; o dashboard depende só de leitura |
| D — Inversão de dependência | Casos de uso recebem interfaces no construtor; o NestJS injeta as implementações |

## Modelo de dados

Nove entidades; valores em centavos (inteiros) e itens de pedido que congelam nome e preço do momento da compra.

| Entidade | Campos principais | Regras |
| --- | --- | --- |
| Product | id, slug, name, description, priceCents, weightGrams, stock, lowStockThreshold, status, images | Excluir = status ARCHIVED; some da loja, fica nos relatórios |
| Ingredient | id, name, benefit | N:N com Product (ProductIngredient); base do ranking de ingredientes |
| Order | id, publicCode, status, customerName, phone, email, endereço (CEP, rua, nº, bairro, cidade, UF, complemento), subtotal, shipping, total, paidAt | publicCode aleatório e não sequencial |
| OrderItem | orderId, productId, productName, unitPriceCents, quantity | Nome e preço copiados no pedido |
| Payment | orderId, provider, providerPaymentId, method, status | providerPaymentId único garante idempotência |
| StockMovement | productId, delta, reason (venda, reposição, ajuste), orderId | Histórico auditável de todo movimento |
| OutboxEvent | id, type, payload, status, attempts, nextAttemptAt | Gravado na mesma transação do pagamento |
| NotificationSetting | channel, enabled, destination | Tokens dos bots ficam em variáveis de ambiente, nunca no banco |
| AdminUser | email, passwordHash | Hash argon2id |

**Ciclo do pedido** (máquina de estados no domínio): Aguardando pagamento → Pago → Enviado → Entregue. Cancelado só a partir de Aguardando pagamento ou Pago; qualquer outra transição lança erro de domínio.

## API

REST versionada em /api/v1, documentada automaticamente com OpenAPI (Swagger). O preço sempre vem do banco, nunca do navegador.

| Método | Rota | Acesso | Faz |
| --- | --- | --- | --- |
| GET | /products | Público | Lista produtos ativos, com filtros |
| GET | /products/:slug | Público | Detalhe do produto |
| GET | /ingredients | Público | Ingredientes para filtro |
| POST | /orders | Público | Cria pedido e devolve dados do pagamento |
| GET | /orders/:publicCode | Público | Status do pedido |
| POST | /webhooks/mercadopago | Mercado Pago | Confirma pagamento (assinatura validada) |
| POST | /admin/auth/login | Vendedora | Login, cookie httpOnly |
| GET | /admin/orders?status= | Vendedora | Vendas por situação |
| PATCH | /admin/orders/:id/status | Vendedora | Muda situação (ex.: enviado) |
| POST | /admin/products | Vendedora | Cria produto |
| PATCH | /admin/products/:id | Vendedora | Edita produto |
| DELETE | /admin/products/:id | Vendedora | Arquiva produto |
| POST | /admin/products/:id/stock-adjustments | Vendedora | Entrada ou saída de estoque |
| GET | /admin/dashboard?from=&to= | Vendedora | Métricas do período |
| PUT | /admin/notifications/settings | Vendedora | Liga canais e destino |
| POST | /admin/notifications/test | Vendedora | Envia mensagem de teste |

## Notificações de venda

O aviso sai só depois do pagamento confirmado, por um worker que lê a outbox; se um canal falhar, a venda não é afetada e o envio é repetido até 3 vezes.

&#91;embedded content: do pagamento ao aviso · outbox + worker\]

Pagamento, estoque e evento são gravados juntos; o envio acontece fora dessa transação, então um Telegram fora do ar nunca desfaz uma venda.

**Canais**

- **Telegram (recomendado para começar)**: gratuito, bot criado em minutos pelo @BotFather; a vendedora só precisa abrir o bot e tocar em Iniciar.
- **WhatsApp**: usar apenas a WhatsApp Cloud API oficial da Meta. Exige conta Business verificada e mensagem por template aprovado, e pode ter custo por conversa. Bibliotecas que automatizam o WhatsApp Web violam os termos e podem banir o número; num repositório público isso pesa contra você.

**Mensagem**

```text
Nova venda! Pedido #A7K2
2x Sabonete de Lavanda — R$ 36,00
1x Sabonete de Argila Verde — R$ 22,00
Frete: R$ 10,00 | Total: R$ 68,00
Entregar para: Maria Souza — (11) 9xxxx-xxxx
Rua das Flores, 120, ap. 3 — Centro, Cidade/UF — CEP 00000-000
Ver no painel: https://sualoja.com.br/painel/vendas/A7K2
```

**Strategy + DIP**

```ts
// domain/ports/notification-channel.ts
export interface NotificationChannel {
  readonly name: 'telegram' | 'whatsapp';
  send(message: SaleNotification): Promise<void>;
}

// application/notify-sale.use-case.ts
export class NotifySaleUseCase {
  constructor(
    private readonly channels: NotificationChannel[],
    private readonly settings: NotificationSettingsRepository,
    private readonly log: NotificationLogRepository,
  ) {}

  async execute(order: Order): Promise<void> {
    const message = SaleNotification.fromOrder(order);
    const enabled = await this.settings.enabledChannels();
    const targets = this.channels.filter((c) => enabled.includes(c.name));
    const results = await Promise.allSettled(targets.map((c) => c.send(message)));
    await this.log.record(order.id, targets, results);
  }
}
```

TelegramChannel e WhatsAppChannel ficam em infrastructure/notifications e são testados com MSW simulando as APIs; nenhum teste chama serviço real.

## Pagamento e checkout

Checkout sem cadastro em uma página, com Pix e cartão pelo Mercado Pago; o pedido só vira pago quando a API confirma com o próprio Mercado Pago.

1. Cliente revisa o carrinho; o front avisa se algum item esgotou.
2. Preenche nome, WhatsApp, e-mail e CEP; o ViaCEP completa rua, bairro e cidade.
3. A API recalcula preços e frete pelo banco e cria o pedido como Aguardando pagamento.
4. A API cria o pagamento no Mercado Pago; a cliente vê o QR Code Pix com copia e cola, ou paga no cartão.
5. O webhook chega; a API valida a assinatura, consulta o pagamento no Mercado Pago e ignora notificações repetidas.
6. Em uma transação: pedido Pago, baixa de estoque com update condicional (stock >= quantidade) e evento na outbox.
7. A cliente vê Pedido confirmado; pedidos não pagos expiram junto com o Pix e são cancelados automaticamente.

**Frete no MVP**: tabela simples configurável no painel (retirada, entrega local, envio com valor fixo). Cálculo por transportadora fica para depois.

**Ambientes**: desenvolvimento e testes usam as credenciais de sandbox do Mercado Pago; as de produção só existem no provedor de deploy.

## Design: Botanical Branding

A identidade lembra ervas, papel artesanal e luz natural: verde-sálvia, creme e terracota, serifa elegante e ilustrações de folhas em traço fino. As cores principais passam no contraste AA sobre o fundo creme.

| Token | Cor | Uso |
| --- | --- | --- |
| sage-700 | #3F5A43 | Títulos, botões primários, navegação |
| sage-400 | #8FA886 | Ícones, detalhes, ilustrações |
| cream-50 | #F7F3EA | Fundo da página |
| clay-100 | #EADFCB | Cards e seções alternadas |
| terracotta-600 | #A0522D | Botão Comprar, preços em destaque |
| ink-900 | #2B2A26 | Texto corrido |
| success | #2F6B3A | Pago, enviado |
| warning | #8A5A00 | Estoque baixo |
| danger | #A3312A | Erros, excluir |

**Tipografia**: Fraunces para títulos e Nunito Sans para texto, via next/font. Base de 16 px na vitrine e 18 px no painel.

**Elementos**: fotos em fundos naturais (madeira, linho), cantos arredondados de 12 a 16 px, sombras suaves, textura leve de papel e ícones de linha (Lucide). Animações curtas e respeitando prefers-reduced-motion.

**Responsividade (mobile-first)**

| Faixa | Vitrine | Painel |
| --- | --- | --- |
| Celular, 360–767 px | 1 coluna, carrinho fixo no rodapé | Barra inferior com 4 abas, cards grandes |
| Tablet, 768–1023 px | 2 colunas | Barra inferior ou lateral recolhida |
| Desktop, 1024 px ou mais | 3 a 4 colunas, filtros laterais | Menu lateral, tabelas e gráficos lado a lado |

**Páginas da vitrine**: início (destaques e compra por benefício), catálogo, produto, carrinho em gaveta, checkout, pedido confirmado, sobre a artesã e políticas (troca, privacidade). Antes de codar, um protótipo no Figma validado com a vendedora.

## Painel para quem não é de tecnologia

O painel funciona como um app de mensagens: quatro abas, palavras do dia a dia e um próximo passo óbvio em cada tela. A meta é a vendedora fazer as tarefas principais sem ajuda.

**Abas fixas** (ícone + texto, sempre visíveis): Início, Vendas, Meus sabonetes, Configurações.

**Início responde três perguntas**, em cards grandes:

- Quanto vendi? Faturamento com botões Hoje, 7 dias e Este mês.
- O que preciso enviar? Vendas pagas ainda não enviadas, com botão Marquei como enviado.
- O que está acabando? Sabonetes abaixo do estoque mínimo, com botão Repor.

**Dashboard simples**: valor médio por venda, gráfico de barras de vendas por dia, top 5 sabonetes e top ingredientes, sempre com o número escrito ao lado da barra.

**Regras de interface**

- Linguagem comum: Vendas (não pedidos/orders), Quantos tenho (não estoque), Tirar da loja.
- Botões com pelo menos 48 px e texto que diz a ação: Salvar sabonete, não OK.
- Estoque com botões + e − e número grande, sem campo para digitar.
- Cadastro de produto em passos: Fotos → Nome e preço → Ingredientes → Revisar, com exemplos dentro dos campos.
- Antes de excluir, confirmação em frase clara e opção Desfazer por 10 segundos.
- Erros humanos: Não consegui salvar. Confira a internet e toque em Tentar de novo.
- Ícone ? em cada card com uma frase de ajuda e tour de boas-vindas no primeiro acesso.
- Fonte de 18 px, alto contraste, Lembrar de mim por 30 dias e opção de instalar como app no celular (PWA).

**Teste com a vendedora a cada etapa**: três tarefas cronometradas — cadastrar um sabonete, marcar uma venda como enviada e descobrir o mais vendido. O que travar vira ajuste na próxima etapa.

## TDD

Todo código de domínio e aplicação nasce de um teste que falha (red → green → refactor), e o histórico de commits mostra esse ciclo para quem avaliar o repositório.

| Nível | Ferramenta | Cobre |
| --- | --- | --- |
| Unitário (maioria) | Vitest | Entidades, value objects (Money, Cep), máquina de estados, casos de uso com fakes em memória |
| Integração | Vitest + Testcontainers + MSW | Repositórios Prisma em Postgres real; adaptadores Mercado Pago, Telegram e WhatsApp com HTTP simulado |
| API | Supertest | Controllers, autenticação, validação, webhook |
| Componentes | Testing Library + vitest-axe | Carrinho, formulários, acessibilidade |
| E2E | Playwright (celular e desktop) | Compra completa e vendedora marcando envio |
| Mutação (bônus) | Stryker | Se os testes do domínio realmente pegam erros |

**Exemplo: teste escrito antes da implementação**

```ts
// domain/order/order.spec.ts
describe('Order', () => {
  it('soma itens e frete no total', () => {
    const order = anOrder()
      .withItem({ unitPrice: Money.cents(1800), quantity: 2 })
      .withShipping(Money.cents(1000))
      .build();

    expect(order.total.cents).toBe(4600);
  });

  it('não deixa enviar pedido ainda não pago', () => {
    const order = anOrder().pendingPayment().build();

    expect(() => order.markAsShipped()).toThrow(OrderNotPaidError);
  });
});
```

**Regras do time**

- Commits em par: test: (vermelho) seguido de feat: ou refactor:.
- Test Data Builders (anOrder) e fakes em memória no lugar de mocks de repositório.
- Nenhum teste chama API externa real.
- CI falha se a cobertura de domínio e aplicação cair abaixo de 90%.

## Segurança e repositório público

Nenhum segredo nem dado real de cliente entra no Git: o repositório mostra o código, e a loja real roda com configurações que só existem no provedor de deploy.

**Segredos**

- Só .env.example com nomes das variáveis; .gitignore cobre todos os .env.
- gitleaks no pre-commit e no CI; secret scanning e push protection ativados no GitHub.
- Chave vazada = revogar na hora. Apagar o commit não basta, o histórico fica.

**Dados pessoais (LGPD)**

- Seeds e screenshots só com dados falsos (faker pt\_BR).
- Logs mascaram telefone, e-mail e endereço.
- Coletar só o necessário para entregar; política de privacidade publicada.

**Aplicação**

- Webhook com assinatura validada, reconsulta ao Mercado Pago e idempotência.
- Senha com argon2id; sessão em cookie httpOnly, Secure e SameSite; rate limit e bloqueio temporário no login.
- Zod em toda entrada; Prisma evita SQL injection; descrições sanitizadas.
- Helmet, CSP e CORS restrito ao domínio da loja.
- Upload de imagem com tipo e tamanho validados, via URL assinada.

**GitHub**

- Branch main protegida: PR obrigatório e CI verde.
- Dependabot, CodeQL e pnpm audit.
- Licença MIT para o código; fotos e marca da loja só com autorização da vendedora, ou imagens de banco livre na demo.
- Demo pública com dados falsos, pagamento em sandbox e um login de painel de demonstração resetado diariamente.

## Etapas

Oito etapas, cada uma entregue por PR com CI verde e encerrada só quando seu critério de pronto é verificado.

&#91;embedded content: roadmap · 8 etapas com critério de pronto\]

Cada caixa traz o critério de pronto da etapa; os checklists abaixo detalham o trabalho.

**Etapa 0 — Fundação**

- [ ] Monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier, Husky, commitlint
- [ ] Docker Compose com Postgres; pipeline de CI; README inicial e ADRs 0001–0002

**Etapa 1 — Domínio (TDD puro)**

- [ ] Money, Cep, Product, Ingredient, Order e máquina de estados
- [ ] Eventos de domínio e portas (repositórios, PaymentGateway, NotificationChannel)

**Etapa 2 — Catálogo**

- [ ] Repositórios Prisma com Testcontainers; GET de produtos e ingredientes
- [ ] Design system botânico; páginas início, catálogo e produto responsivas

**Etapa 3 — Carrinho e checkout**

- [ ] Carrinho, formulário com CEP, CreateOrder e integração Mercado Pago sandbox
- [ ] Webhook idempotente, baixa de estoque transacional, expiração de pedidos

**Etapa 4 — Notificações**

- [ ] Outbox + worker com retentativas; TelegramChannel
- [ ] WhatsAppChannel (Cloud API) e mensagem de teste pelo painel

**Etapa 5 — Painel**

- [ ] Login seguro; vendas por situação; criar, editar, arquivar produto; ajuste de estoque
- [ ] Primeiro teste de usabilidade com a vendedora

**Etapa 6 — Dashboard**

- [ ] Consultas agregadas: faturamento, valor médio, mais vendidos, ingredientes, estoque baixo
- [ ] Cards e gráficos simples no Início

**Etapa 7 — Lançamento**

- [ ] Auditoria de acessibilidade e Lighthouse; E2E completos em celular e desktop
- [ ] Teste final com a vendedora, deploy de produção e demo pública com dados falsos

## CI/CD e deploy

GitHub Actions roda tudo em cada PR, e só código aprovado na main vai para produção.

1. Instala dependências com cache do pnpm.
2. Lint, typecheck e gitleaks.
3. Testes unitários com relatório de cobertura.
4. Integração com Postgres via Testcontainers.
5. Build de web e API; deploy de preview.
6. E2E Playwright contra o preview.
7. CodeQL em paralelo; merge na main aplica as migrations (prisma migrate deploy) e publica.

| Peça | Onde | Observação |
| --- | --- | --- |
| Web (Next.js) | Vercel | Preview automático por PR |
| API + worker | Render, Railway ou Fly.io | Imagem Docker |
| Postgres | Neon ou Supabase | Branch de banco por ambiente |
| Imagens | Cloudinary ou Cloudflare R2 | Upload assinado |
| Monitoramento | Sentry + logs pino + health check | Alerta de erro e de queda |

**Custos**: todos têm plano gratuito suficiente para começar. Os custos variáveis reais são a taxa do Mercado Pago por venda, as conversas da API do WhatsApp e o domínio .com.br; confira os valores atuais antes do lançamento.

## README e portfólio

O README é a vitrine técnica: quem avalia deve entender o projeto em 30 segundos e rodá-lo em 3 comandos.

- Banner, GIF da compra no celular e do painel, link da demo e badges de CI e cobertura.
- Stack, diagrama de arquitetura e link para os ADRs.
- Como rodar: pnpm install, docker compose up -d, pnpm dev; e como rodar os testes.
- Roadmap espelhado no GitHub Projects, com issues e PRs pequenos e descritos.
- ADRs sugeridos: 0001 monorepo, 0002 Clean Architecture, 0003 Telegram primeiro, 0004 outbox para avisos.
- README em inglês com seção em português, para recrutadores de fora e daqui.

No seu site de portfólio, um estudo de caso curto: problema da vendedora, decisões técnicas, como o TDD guiou o domínio e o que você aprendeu, com links para demo e repositório.
