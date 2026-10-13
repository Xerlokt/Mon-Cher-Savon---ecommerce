// Prepares the dedicated E2E database: migrations, a clean slate, demo catalog and the seller account.
// It refuses to touch any database whose name does not end in "_e2e".
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E } from './env.mjs';

const dbName = new URL(E2E.databaseUrl).pathname.replace(/^\//, '');
if (!dbName.endsWith('_e2e')) {
  console.error(`Refusing to reset "${dbName}": the E2E database name must end with "_e2e".`);
  process.exit(1);
}

const apiDir = fileURLToPath(new URL('../../apps/api', import.meta.url));
const sql = (name) => `"${fileURLToPath(new URL(`./${name}`, import.meta.url))}"`;
const env = {
  ...process.env,
  npm_config_verify_deps_before_run: 'false',
  DATABASE_URL: E2E.databaseUrl,
  ADMIN_EMAIL: E2E.adminEmail,
  ADMIN_PASSWORD: E2E.adminPassword,
};
const windows = process.platform === 'win32';
const pnpm = windows ? 'pnpm.cmd' : 'pnpm';
const run = (...args) =>
  execFileSync(pnpm, args, { cwd: apiDir, env, stdio: 'inherit', shell: windows });
const execSql = (name) =>
  run('exec', 'prisma', 'db', 'execute', '--file', sql(name), '--schema', 'prisma/schema.prisma');

// Non-destructive: creates the database if it is missing and applies pending migrations.
run('exec', 'prisma', 'migrate', 'deploy');
// Empty only the E2E tables, then load demo data.
execSql('clean.sql');
run('db:seed');
run('db:seed-admin');
// Plenty of stock so tests never run out (the sold-out demo product stays sold out) and the
// Telegram channel enabled, as the seller would have configured it.
execSql('boost-stock.sql');
