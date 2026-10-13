import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { assertSafeToReset } from '../src/demo/demo-guard.js';

/** Wipes the public demo database and loads fake data again. Run daily (see .github/workflows/demo-reset.yml). */
const dbName = assertSafeToReset(process.env);
const prisma = new PrismaClient();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function main(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OrderItem","Payment","StockMovement","NotificationLog","OutboxEvent","Order","ProductIngredient","Product","Ingredient","NotificationSetting","AdminUser" RESTART IDENTITY CASCADE',
  );
  await prisma.$disconnect();
  const env = {
    ...process.env,
    ADMIN_EMAIL: process.env['DEMO_ADMIN_EMAIL'] ?? 'demo@example.com',
    ADMIN_PASSWORD: process.env['DEMO_ADMIN_PASSWORD'] ?? 'demo-painel-2026',
  };
  for (const script of ['db:seed', 'db:seed-admin']) {
    execFileSync(pnpm, ['run', script], {
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
  console.log(`Demo database "${dbName}" reset with fake data.`);
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
