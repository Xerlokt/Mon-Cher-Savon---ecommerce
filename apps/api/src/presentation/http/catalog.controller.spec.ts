import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BrowseCatalogUseCase } from '../../application/browse-catalog.use-case.js';
import type { CatalogQuery } from '../../domain/ports/index.js';
import { CatalogController } from './catalog.controller.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';

const lavanda = {
  id: 'p1',
  slug: 'lavanda',
  name: 'Lavanda',
  priceCents: 1800,
  aroma: 'floral',
  imageUrl: null,
  soldOut: false,
};

const fake: CatalogQuery & { filters: unknown[] } = {
  filters: [],
  async listProducts(filter) {
    this.filters.push(filter);
    return [lavanda];
  },
  async getProductBySlug(slug) {
    return slug === 'lavanda'
      ? { ...lavanda, description: '', usage: '', weightGrams: 100, images: [], ingredients: [] }
      : null;
  },
  async listIngredients() {
    return [{ id: 'i1', slug: 'argila', name: 'Argila', benefit: 'oleosa' }];
  },
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [CatalogController],
    providers: [{ provide: BrowseCatalogUseCase, useValue: new BrowseCatalogUseCase(fake) }],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('CatalogController', () => {
  it('GET /api/v1/products passes validated filters', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?aroma=floral').expect(200);
    expect(res.body).toHaveLength(1);
    expect(fake.filters.at(-1)).toEqual({ aroma: 'floral' });
  });

  it('rejects invalid filters with 400', async () => {
    await request(app.getHttpServer()).get('/api/v1/products?aroma=').expect(400);
  });

  it('GET /api/v1/products/:slug returns detail or 404', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/lavanda').expect(200);
    await request(app.getHttpServer()).get('/api/v1/products/nope').expect(404);
  });

  it('GET /api/v1/ingredients lists ingredients', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ingredients').expect(200);
    expect(res.body[0].slug).toBe('argila');
  });
});
