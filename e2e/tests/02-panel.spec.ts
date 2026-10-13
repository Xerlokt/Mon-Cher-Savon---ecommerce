import { expect, test, type Page } from '@playwright/test';
import { E2E } from '../support/env.mjs';
import {
  TINY_PNG,
  createPaidOrder,
  expectAccessible,
  expectTouchTarget,
  resetMocks,
  telegramMessages,
  waitForTelegram,
} from '../support/helpers';

async function login(page: Page) {
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/painel\/entrar$/);
  await page.getByLabel('E-mail').fill(E2E.adminEmail);
  await page.getByLabel('Senha', { exact: true }).fill(E2E.adminPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

async function skipTourIfShown(page: Page) {
  const skip = page.getByRole('button', { name: 'Pular' });
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('painel da vendedora', () => {
  test.beforeAll(async () => {
    await resetMocks();
    // This file does not depend on the storefront file: it makes its own paid sale.
    await createPaidOrder();
  });

  test('login: protege o painel, explica erros e lembra da sessão', async ({ page, context }) => {
    await page.goto('/painel/vendas');
    await expect(page).toHaveURL(/\/painel\/entrar\?next=%2Fpainel%2Fvendas$/);
    await expectAccessible(page, 'entrar');

    await page.getByLabel('E-mail').fill(E2E.adminEmail);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();

    await page.getByLabel('Senha', { exact: true }).fill(E2E.adminPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/painel\/vendas$/); // volta para onde ia

    const cookie = (await context.cookies()).find((c) => c.name === 'mcs_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect(cookie?.expires, '"lembrar de mim" cria um cookie de 30 dias').toBeGreaterThan(
      Date.now() / 1000 + 29 * 24 * 3600,
    );

    // Já logada, a tela de login redireciona
    await page.goto('/painel/entrar');
    await expect(page).toHaveURL(/\/painel$/);
  });

  test('início, vendas e dashboard: da venda paga ao "Marquei como enviado"', async ({ page }) => {
    await login(page);
    await skipTourIfShown(page);
    await expectAccessible(page, 'painel início');

    // Quanto vendi? (a venda da loja já foi paga)
    await expect(page.getByRole('heading', { name: 'Quanto vendi?' })).toBeVisible();
    await expect(page.getByText(/valor médio de/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Sabonetes mais vendidos' })).toContainText(
      'Sabonete de Lavanda',
    );
    await page.getByRole('button', { name: '7 dias' }).click();
    await expect(page.getByRole('list', { name: 'Vendas por dia' })).toBeVisible();
    await expectAccessible(page, 'painel início (7 dias)');

    // O que preciso enviar?
    const toShip = page.getByRole('region', { name: 'O que preciso enviar?' });
    await expect(toShip.getByRole('link', { name: 'Maria Souza' }).first()).toBeVisible();
    const ship = toShip.getByRole('button', { name: 'Marquei como enviado' }).first();
    await expectTouchTarget(ship, 48);
    const before = await toShip.getByRole('button', { name: 'Marquei como enviado' }).count();
    await ship.click();
    await expect(page.getByText('Pronto! Marcado como enviado.')).toBeVisible();
    await expect(toShip.getByRole('button', { name: 'Marquei como enviado' })).toHaveCount(
      before - 1,
    );

    // Vendas: filtro e detalhe com endereço
    await page.getByRole('link', { name: 'Vendas', exact: true }).click();
    await expectAccessible(page, 'vendas');
    await page.getByRole('link', { name: 'Enviadas' }).click();
    await expect(page.getByRole('link', { name: 'Maria Souza' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Maria Souza' }).first().click();
    await expect(page.getByRole('heading', { name: 'Entregar para' })).toBeVisible();
    await expect(page.getByText(/Avenida Paulista, 120, ap\. 3/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marquei como entregue' })).toBeVisible();
    await expectAccessible(page, 'detalhe da venda');
    await page.getByRole('button', { name: 'Marquei como entregue' }).click();
    await expect(page.getByText('Pronto! Marcado como entregue.')).toBeVisible();
  });

  test('sabonetes: estoque com + e −, cadastro em passos com foto e desfazer', async ({ page }) => {
    await login(page);
    await skipTourIfShown(page);
    await page.getByRole('link', { name: 'Meus sabonetes' }).click();
    await expectAccessible(page, 'meus sabonetes');

    // Estoque sem digitar: + e −
    const card = page.getByRole('listitem').filter({ hasText: 'Sabonete de Lavanda' }).first();
    const stock = card.getByRole('group', { name: /Quantos tenho/ }).locator('output');
    const start = Number(await stock.textContent());
    await card.getByRole('button', { name: /Colocar mais um/ }).click();
    await expect(stock).toHaveText(String(start + 1));
    await card.getByRole('button', { name: /Tirar um/ }).click();
    await expect(stock).toHaveText(String(start));
    await expectTouchTarget(card.getByRole('button', { name: /Colocar mais um/ }), 48);

    // Cadastro em 4 passos
    await page.getByRole('link', { name: 'Novo sabonete' }).click();
    await expect(page.getByRole('heading', { name: '1. Fotos' })).toBeVisible();
    await page.getByLabel(/Escolher fotos/).setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByRole('button', { name: 'Tirar esta foto' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Continuar' }).click(); // sem nome nem preço
    await expect(page.getByText(/Dê um nome ao sabonete/)).toBeVisible();
    await expect(page.getByText(/Informe o preço/)).toBeVisible();
    await page.getByLabel('Nome do sabonete').fill('Sabonete E2E de Alecrim');
    await page.getByLabel('Preço (R$)').fill('12,50');
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expectAccessible(page, 'cadastro: nome e preço');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel(/karité/i).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Sabonete E2E de Alecrim')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar sabonete' }).click();

    await expect(page).toHaveURL(/\/painel\/sabonetes$/);
    const created = page.getByRole('listitem').filter({ hasText: 'Sabonete E2E de Alecrim' });
    await expect(created).toBeVisible();
    await expect(created.getByRole('img')).toHaveCount(0); // a foto é decorativa (alt vazio)
    await expect(created.locator('img')).toHaveAttribute('src', /^\/uploads\/[0-9a-f]+\.png$/);

    // A loja mostra o novo sabonete
    // (a vitrine guarda a lista por até 15 s, então recarregamos até ela aparecer)
    await expect(async () => {
      await page.goto('/catalogo');
      await expect(page.getByRole('link', { name: /Sabonete E2E de Alecrim/ })).toBeVisible({
        timeout: 1500,
      });
    }).toPass({ timeout: 45_000, intervals: [2000] });
    await page.goto('/painel/sabonetes');

    // Tirar da loja com confirmação e Desfazer (10 s)
    await created.getByRole('button', { name: 'Tirar da loja' }).click();
    await expect(page.getByText('Tirar "Sabonete E2E de Alecrim" da loja?')).toBeVisible();
    await page.getByRole('button', { name: 'Sim, tirar da loja' }).click();
    await expect(page.getByText('"Sabonete E2E de Alecrim" saiu da loja.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fora da loja' })).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('heading', { name: 'Fora da loja' })).toHaveCount(0);
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'Sabonete E2E de Alecrim' })
        .getByRole('button', {
          name: 'Tirar da loja',
        }),
    ).toBeVisible();
  });

  test('configurações: Telegram com mensagem de teste, tour e sair', async ({ page }) => {
    await login(page);

    // Tour de boas-vindas no primeiro acesso (por navegador)
    await expect(page.getByRole('dialog', { name: 'Bem-vinda ao seu painel!' })).toBeVisible();
    await expectAccessible(page, 'tour de boas-vindas');
    for (const step of ['Próximo', 'Próximo', 'Próximo']) {
      await page.getByRole('button', { name: step }).click();
    }
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('link', { name: 'Configurações' }).click();
    await expectAccessible(page, 'configurações');
    const telegram = page.getByRole('region', { name: 'Telegram' });
    await expect(page.getByRole('region', { name: 'WhatsApp' })).toContainText(
      'ainda não foi ativado',
    );

    await telegram.getByLabel('Número do chat do Telegram').fill('abc');
    await telegram.getByRole('button', { name: 'Salvar' }).click();
    await expect(telegram.getByRole('alert')).toContainText('só números');

    await telegram.getByLabel('Número do chat do Telegram').fill('555000111');
    await telegram.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Telegram salvo!')).toBeVisible();
    await telegram.getByRole('button', { name: 'Enviar mensagem de teste' }).click();
    await expect(page.getByText('Mensagem enviada! Olhe o seu Telegram.')).toBeVisible();

    const message = await waitForTelegram(/teste/);
    expect(message.chat_id).toBe('555000111');
    expect((await telegramMessages()).length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Sair do painel' }).click();
    await expect(page).toHaveURL(/\/painel\/entrar$/);
    await page.goto('/painel/vendas');
    await expect(page).toHaveURL(/\/painel\/entrar/);
  });

  test('o manifesto permite instalar o painel como app', async ({ request }) => {
    const manifest = await (await request.get('/painel/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      start_url: '/painel',
      display: 'standalone',
      scope: '/painel/',
    });
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect((await request.get(icon.src)).ok()).toBe(true);
    }
    expect((await request.get('/painel-sw.js')).ok()).toBe(true);
  });
});
