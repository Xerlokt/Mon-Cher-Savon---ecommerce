import { expect, test, type Page } from '@playwright/test';
import { E2E } from '../support/env.mjs';
import { createPaidOrder, expectTouchTarget, mockViaCep, resetMocks } from '../support/helpers';

/** The smallest phone we support (WCAG 1.4.10 reflow: no horizontal scrolling at 320-360 px). */
const SMALL_PHONE = { width: 360, height: 740 };

async function expectNoHorizontalScroll(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    widest: [...document.querySelectorAll('body *')]
      .map((el) => ({ el, right: el.getBoundingClientRect().right }))
      .filter((x) => x.right > document.documentElement.clientWidth + 1)
      .slice(0, 3)
      .map((x) => `${x.el.tagName.toLowerCase()}.${String(x.el.className).slice(0, 60)}`),
  }));
  expect(
    overflow.scrollWidth,
    `${label} overflows at 360 px: ${overflow.widest.join(' | ')}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('layout em celular pequeno (360 px)', () => {
  test.use({ viewport: SMALL_PHONE });

  test.beforeAll(async () => {
    await resetMocks();
    await createPaidOrder();
  });

  test('a loja não rola para os lados', async ({ page }) => {
    await mockViaCep(page);
    for (const path of [
      '/',
      '/catalogo',
      '/produto/sabonete-de-lavanda',
      '/sobre',
      '/politicas/privacidade',
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }

    // Gaveta do carrinho e checkout com itens
    await page.goto('/produto/sabonete-de-lavanda');
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    const checkout = page.getByRole('dialog', { name: 'Seu carrinho' }).getByRole('link', {
      name: 'Finalizar compra',
    });
    await expect(checkout).toBeInViewport();
    await expectNoHorizontalScroll(page, 'gaveta do carrinho');
    await checkout.click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expectNoHorizontalScroll(page, '/checkout');
    await expectTouchTarget(page.getByRole('button', { name: 'Pagar com Pix' }), 48);
  });

  test('o painel não rola para os lados e as abas têm alvos de toque grandes', async ({ page }) => {
    await page.goto('/painel/entrar');
    await expectNoHorizontalScroll(page, '/painel/entrar');
    await page.getByLabel('E-mail').fill(E2E.adminEmail);
    await page.getByLabel('Senha', { exact: true }).fill(E2E.adminPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/painel$/);
    const skip = page.getByRole('button', { name: 'Pular' });
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();

    for (const tab of ['Início', 'Vendas', 'Meus sabonetes', 'Configurações']) {
      await expectTouchTarget(page.getByRole('link', { name: tab, exact: true }), 56);
    }
    for (const path of [
      '/painel',
      '/painel/vendas',
      '/painel/sabonetes',
      '/painel/sabonetes/novo',
      '/painel/configuracoes',
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
    // As quatro abas ficam sempre visíveis, mesmo depois de rolar a página
    await page.goto('/painel/sabonetes');
    await page.mouse.wheel(0, 2000);
    await expect(page.getByRole('link', { name: 'Configurações', exact: true })).toBeInViewport();
  });
});
