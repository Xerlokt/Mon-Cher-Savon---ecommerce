// Runs Lighthouse (mobile, simulated slow 4G) against the production build of the store.
// Starts the same stack as the E2E tests, audits the public pages, prints a table and fails when a
// score or Largest Contentful Paint is under the targets below.
//
//   pnpm --filter @mon-cher-savon/e2e lighthouse
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { E2E, PORTS, apiEnv, webEnv } from './env.mjs';

const TARGETS = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.9, seo: 0.95 };
const LCP_BUDGET_MS = 2500;
// /checkout is noindex on purpose (it must not be crawled), so the SEO score does not apply to it.
const PAGES = [
  { path: '/' },
  { path: '/catalogo' },
  { path: '/produto/sabonete-de-lavanda' },
  { path: '/sobre' },
  { path: '/checkout', skip: ['seo'] },
];

const root = fileURLToPath(new URL('../../', import.meta.url));
const children = [];

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: 'ignore', shell: false });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // already gone
    }
  }
}

async function waitFor(url, timeoutMs = 300_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const node = process.execPath;
  const api = `${root}apps/api`;
  const web = `${root}apps/web`;

  start(node, [`${root}e2e/support/mock-services.mjs`], root, {
    ...process.env,
    MOCK_PORT: String(PORTS.mock),
  });
  execFileSync(node, [`${root}e2e/support/prepare-db.mjs`], {
    cwd: api,
    env: apiEnv(),
    stdio: 'inherit',
  });
  start(node, ['node_modules/tsx/dist/cli.mjs', 'src/main.ts'], api, apiEnv());
  await waitFor(`${E2E.apiUrl}/api/v1/shipping-options`);

  execFileSync(node, ['-e', "require('fs').rmSync('.next',{recursive:true,force:true})"], {
    cwd: web,
  });
  execFileSync(node, ['node_modules/next/dist/bin/next', 'build'], {
    cwd: web,
    env: webEnv(),
    stdio: 'ignore',
  });
  start(node, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORTS.web)], web, webEnv());
  await waitFor(`${E2E.webUrl}/catalogo`);

  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  const rows = [];
  let failed = false;
  try {
    for (const { path, skip = [] } of PAGES) {
      const result = await lighthouse(`${E2E.webUrl}${path}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: Object.keys(TARGETS),
      });
      const lhr = result.lhr;
      const scores = Object.fromEntries(
        Object.keys(TARGETS).map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)]),
      );
      const lcp = Math.round(lhr.audits['largest-contentful-paint'].numericValue ?? 0);
      const cls = Number((lhr.audits['cumulative-layout-shift'].numericValue ?? 0).toFixed(3));
      const tbt = Math.round(lhr.audits['total-blocking-time'].numericValue ?? 0);
      const problems = Object.entries(TARGETS)
        .filter(([c, min]) => !skip.includes(c) && (lhr.categories[c].score ?? 0) < min)
        .map(([c]) => c);
      if (lcp > LCP_BUDGET_MS) problems.push('LCP');
      if (problems.length > 0) failed = true;

      const failingAudits = Object.values(lhr.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative')
        .map((a) => `${a.id} (${Math.round((a.score ?? 0) * 100)})`)
        .slice(0, 8);
      rows.push({
        path,
        ...scores,
        'LCP ms': lcp,
        CLS: cls,
        'TBT ms': tbt,
        problems: problems.join(',') || 'ok',
      });
      if (problems.length > 0) console.log(`  ${path}: ${failingAudits.join(', ')}`);
    }
  } finally {
    await chrome.kill();
    stopAll();
  }

  console.table(rows);
  writeFileSync(
    `${root}e2e/lighthouse-report.json`,
    JSON.stringify({ targets: TARGETS, lcpBudgetMs: LCP_BUDGET_MS, rows }, null, 2),
  );
  if (failed) {
    console.error('Lighthouse targets not met.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  stopAll();
  process.exitCode = 1;
});

process.on('exit', stopAll);
