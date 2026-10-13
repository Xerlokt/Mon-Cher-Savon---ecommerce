import { defineConfig, devices } from '@playwright/test';
import { E2E, PORTS, apiEnv, webEnv } from './support/env.mjs';

const reuse = !process.env['CI'];

/**
 * Runs the whole stack against a throwaway database and local mocks of Mercado Pago and Telegram.
 * Tests run one at a time because they share that database.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: E2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 5'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'node support/mock-services.mjs',
      url: `${E2E.mockUrl}/__health`,
      reuseExistingServer: reuse,
      env: { MOCK_PORT: String(PORTS.mock) },
    },
    {
      // Recreate the throwaway database first, then start the API on it.
      command:
        'node ../../e2e/support/prepare-db.mjs && node node_modules/tsx/dist/cli.mjs src/main.ts',
      cwd: '../apps/api',
      url: `${E2E.apiUrl}/api/v1/shipping-options`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: apiEnv() as Record<string, string>,
    },
    {
      // A fresh build every time: the data cache of an older run would hold product ids of an older database.
      command: `node -e "require('fs').rmSync('.next',{recursive:true,force:true})" && node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start -p ${PORTS.web}`,
      cwd: '../apps/web',
      url: `${E2E.webUrl}/catalogo`,
      reuseExistingServer: reuse,
      timeout: 300_000,
      env: webEnv() as Record<string, string>,
    },
  ],
});
