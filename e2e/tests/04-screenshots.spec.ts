import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { E2E } from '../support/env.mjs';
import { createPaidOrder, mockViaCep, resetMocks } from '../support/helpers';

/**
 * Regenerates the README images in docs/screenshots. It is not part of the normal suite:
 *   SCREENSHOTS=1 pnpm --filter @mon-cher-savon/e2e exec playwright test 04-screenshots
 */
test.skip(!process.env['SCREENSHOTS'], 'only runs when SCREENSHOTS=1');

const outDir = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

async function shot(page: Page, name: string, fullPage = false) {
  mkdirSync(outDir, { recursive: true });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage, animations: 'disabled' });
}

async function login(page: Page) {
  await page.goto('/painel/entrar');
  await page.getByLabel('E-mail').fill(E2E.adminEmail);
  await page.getByLabel('Senha', { exact: true }).fill(E2E.adminPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  const skip = page.getByRole('button', { name: 'Pular' });
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click();
}

test.beforeAll(async () => {
  await resetMocks();
  await createPaidOrder('Maria Souza');
  await createPaidOrder('Ana Lima');
});

test('loja', async ({ page }, info) => {
  const size = info.project.name; // celular | desktop
  await mockViaCep(page);
  await page.goto('/');
  await shot(page, `loja-inicio-${size}`);
  await page.goto('/catalogo');
  await shot(page, `loja-catalogo-${size}`);
  await page.goto('/produto/sabonete-de-lavanda');
  await shot(page, `loja-produto-${size}`);
});

test('painel', async ({ page }, info) => {
  const size = info.project.name;
  await login(page);
  await shot(page, `painel-inicio-${size}`);
  await page.goto('/painel/vendas');
  await shot(page, `painel-vendas-${size}`);
  await page.goto('/painel/sabonetes');
  await shot(page, `painel-sabonetes-${size}`);
});
