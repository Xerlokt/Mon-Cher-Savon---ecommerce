import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { BrowseCatalogUseCase } from '../../application/browse-catalog.use-case.js';

const filterSchema = z.object({
  ingredient: z.string().trim().min(1).max(80).optional(),
  aroma: z.string().trim().min(1).max(80).optional(),
  benefit: z.string().trim().min(1).max(80).optional(),
});

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(@Inject(BrowseCatalogUseCase) private readonly catalog: BrowseCatalogUseCase) {}

  @Get('products')
  @ApiOperation({ summary: 'Lista produtos ativos, com filtros' })
  @ApiQuery({ name: 'ingredient', required: false })
  @ApiQuery({ name: 'aroma', required: false })
  @ApiQuery({ name: 'benefit', required: false })
  list(@Query() query: Record<string, unknown>) {
    return this.catalog.list(filterSchema.parse(query));
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Detalhe do produto' })
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Get('ingredients')
  @ApiOperation({ summary: 'Ingredientes para filtro' })
  ingredients() {
    return this.catalog.ingredients();
  }
}
