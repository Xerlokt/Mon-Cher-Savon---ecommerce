import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BrowseCatalogUseCase } from './application/browse-catalog.use-case.js';
import { PrismaCatalogQuery } from './infrastructure/prisma/prisma-catalog.query.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';
import { CatalogController } from './presentation/http/catalog.controller.js';
import { DomainExceptionFilter } from './presentation/http/domain-exception.filter.js';

@Module({
  controllers: [CatalogController],
  providers: [
    PrismaService,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    {
      provide: BrowseCatalogUseCase,
      useFactory: (prisma: PrismaService) =>
        new BrowseCatalogUseCase(new PrismaCatalogQuery(prisma)),
      inject: [PrismaService],
    },
  ],
})
export class AppModule {}
