import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { UnitOfWork } from '../../domain/ports/index.js';

export type Db = Prisma.TransactionClient;

/** Gives repositories the active transaction client (if any) so they join the same transaction. */
export interface DbProvider {
  readonly db: Db;
}

export class TransactionalDb implements DbProvider, UnitOfWork {
  private readonly storage = new AsyncLocalStorage<Db>();

  constructor(private readonly prisma: PrismaClient) {}

  get db(): Db {
    return this.storage.getStore() ?? this.prisma;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return work();
    return this.prisma.$transaction((tx) => this.storage.run(tx, work), { timeout: 15_000 });
  }
}
