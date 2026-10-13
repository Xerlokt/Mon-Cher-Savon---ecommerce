import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

export interface TestDatabase {
  prisma: PrismaClient;
  url: string;
  stop(): Promise<void>;
}

/** Starts a throwaway Postgres, applies migrations and returns a connected client. */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();
  const url = container.getConnectionUri();
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();
  return {
    prisma,
    url,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
