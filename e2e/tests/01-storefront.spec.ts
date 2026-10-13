import { expect, test } from '@playwright/test';
import {
  expectAccessible,
  expectTouchTarget,
  mockViaCep,
  payAndNotify,
  resetMocks,
  waitForTelegram,
} from '../support/helpers';

test.describe('loja: compra completa', () => {
  test.beforeAll(async () => {
    await resetMocks();
  });

  test('a cliente escolhe, paga com Pix, vê o pedido confirmado e a vendedora é avisada', async ({
    page,
  }) => {
    await mockViaCep(page);

    // Início → catálogo filtrado por benefício
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sabonetes feitos à mão, com cuidado' }),
    ).toBeVisible();
    await expectAccessible(page, 'início');

    await page.getByRole('link', { name: 'Ver sabonetes' }).click();
    await expect(page).toHaveURL(/\/catalogo$/);
    await expectAccessible(page, 'catálogo');

    await page.getByRole('link', { name: 'Pele seca' }).click();
    await expect(page).toHaveURL(/benefit=Pele(\+|%20)seca/);
    await expect(page.getByRole('link', { name: /Sabonete de Lavanda/ })).toBeVisible();
    await expectTouchTarget(page.getByRole('link', { name: 'Limpar filtros' }));

    // Produto
    await page.getByRole('link', { name: /Sabonete de Lavanda/ }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sabonete de Lavanda' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingredientes' })).toBeVisible();
    await expectAccessible(page, 'produto');

    const add = page.getByRole('button', { name: 'Adicionar ao carrinho' });
    await expectTouchTarget(add, 48);
    await add.click();

    // Carrinho em gaveta
    const drawer = page.getByRole('dialog', { name: 'Seu carrinho' });
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole('button', { name: /Aumentar quantidade de Sabonete de Lavanda/ })
      .click();
    await expect(drawer.getByText('2', { exact: true })).toBeVisible();
    await drawer.getByRole('link', { name: 'Finalizar compra' }).click();

    // Checkout
    await expect(page.getByRole('heading', { level: 1, name: 'Finalizar compra' })).toBeVisible();
    await page.getByLabel('Nome completo').fill('Maria Souza');
    await page.getByLabel('WhatsApp').fill('(11) 91234-5678');
    await page.getByLabel('E-mail').fill('maria@example.com');
    await page.getByLabel('CEP').fill('01310-100');
    await expect(page.getByLabel('Rua')).toHaveValue('Avenida Paulista');
    await expect(page.getByLabel('Cidade')).toHaveValue('São Paulo');
    await page.getByLabel('Número', { exact: true }).fill('120');
    await page.getByLabel('Complemento').fill('ap. 3');
    await page.getByLabel(/Entrega local/).check();
    await expectAccessible(page, 'checkout');

    await page.getByRole('button', { name: 'Pagar com Pix' }).click();

    // Página do pedido: aguardando o Pix
    await expect(page).toHaveURL(/\/pedido\/[A-Z0-9]{6}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Aguardando o pagamento' }),
    ).toBeVisible();
    await expect(page.getByText(/00020126E2E\d+BR\.GOV\.BCB\.PIX/)).toBeVisible();
    await expect(page.getByAltText('QR Code do Pix')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toBeVisible();
    await expectAccessible(page, 'pedido aguardando pagamento');

    // O provedor confirma o pagamento (webhook assinado) e a página atualiza sozinha
    await payAndNotify();
    await expect(page.getByRole('heading', { level: 1, name: 'Pedido confirmado!' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Pague com Pix')).toHaveCount(0);
    await expectAccessible(page, 'pedido confirmado');

    // A vendedora recebe o aviso com itens, total e endereço
    const message = await waitForTelegram('Nova venda!');
    expect(message.chat_id).toBe('987654321');
    expect(message.text).toContain('2x Sabonete de Lavanda');
    expect(message.text).toContain('Maria Souza');
    expect(message.text).toContain('(11) 91234-5678');
    expect(message.text).toContain('Avenida Paulista, 120, ap. 3');
    expect(message.text).toMatch(/Frete: R\$\s10,00/);
  });

  test('o carrinho sobrevive a recarregar a página', async ({ page }) => {
    await page.goto('/catalogo');
    await page.getByRole('link', { name: /Sabonete de Calêndula/ }).click();
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(page.getByRole('dialog', { name: 'Seu carrinho' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('button', { name: /Carrinho/ }).first()).toContainText('1');
  });

  test('produto esgotado não pode ser comprado', async ({ page }) => {
    await page.goto('/produto/sabonete-de-mel');
    await expect(page.getByRole('button', { name: 'Esgotado' })).toBeDisabled();
  });

  test('páginas institucionais e SEO', async ({ page, request }) => {
    for (const [path, heading] of [
      ['/sobre', 'A artesã por trás dos sabonetes'],
      ['/politicas/privacidade', 'Política de privacidade'],
      ['/politicas/trocas', 'Trocas e devoluções'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectAccessible(page, path);
    }

    await page.goto('/produto/sabonete-de-lavanda');
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    const product = JSON.parse(jsonLd ?? '{}');
    expect(product['@type']).toBe('Product');
    expect(product.offers.priceCurrency).toBe('BRL');

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/produto/sabonete-de-lavanda');
    expect(sitemap).toContain('/politicas/privacidade');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /painel');
  });

  test('cabeçalhos de segurança estão presentes', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBeDefined();
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
