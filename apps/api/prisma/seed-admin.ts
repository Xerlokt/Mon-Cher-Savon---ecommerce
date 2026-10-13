import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

/**
 * Creates or updates the seller account from ADMIN_EMAIL and ADMIN_PASSWORD.
 * Never commit real credentials: set them in the shell or in a local .env.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  const password = process.env['ADMIN_PASSWORD'];
  if (!email || !password) throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
  if (password.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`Vendedora ${email} pronta.`);
}

main()
  .catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
