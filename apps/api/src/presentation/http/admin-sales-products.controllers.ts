import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminOrderStatusFilterSchema,
  changeOrderStatusSchema,
  ingredientInputSchema,
  productInputSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from '@mon-cher-savon/contracts';
import { ChangeOrderStatusUseCase } from '../../application/admin-orders.use-cases.js';
import {
  AdjustStockUseCase,
  ArchiveProductUseCase,
  CreateIngredientUseCase,
  CreateProductUseCase,
  ProductNotFoundForAdminError,
  RestoreProductUseCase,
  UpdateProductUseCase,
} from '../../application/admin-products.use-cases.js';
import { OrderNotFoundError } from '../../application/get-order-status.use-case.js';
import type {
  AdminOrderQuery,
  AdminProductRepository,
  ImageStorage,
} from '../../domain/ports/index.js';
import { DomainError } from '../../domain/shared/domain-error.js';
import {
  MAX_IMAGE_BYTES,
  detectImageExtension,
} from '../../infrastructure/storage/local-image-storage.js';
import { AdminGuard } from './admin.guard.js';

export const ADMIN_ORDER_QUERY = 'ADMIN_ORDER_QUERY';
export const ADMIN_PRODUCT_REPOSITORY = 'ADMIN_PRODUCT_REPOSITORY';
export const IMAGE_STORAGE = 'IMAGE_STORAGE';

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    @Inject(ADMIN_ORDER_QUERY) private readonly query: AdminOrderQuery,
    @Inject(ChangeOrderStatusUseCase) private readonly change: ChangeOrderStatusUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Vendas por situação' })
  list(@Query('status') status?: string) {
    const filter = status ? adminOrderStatusFilterSchema.parse(status) : undefined;
    return this.query.list(filter);
  }

  @Get(':publicCode')
  @ApiOperation({ summary: 'Detalhe da venda' })
  async detail(@Param('publicCode') publicCode: string) {
    const order = await this.query.getByPublicCode(publicCode.toUpperCase());
    if (!order) throw new OrderNotFoundError();
    return order;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Muda a situação (ex.: enviado)' })
  async status(@Param('id') id: string, @Body() body: unknown) {
    const { status } = changeOrderStatusSchema.parse(body);
    await this.change.execute(id, status);
    return { ok: true };
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    @Inject(ADMIN_PRODUCT_REPOSITORY) private readonly products: AdminProductRepository,
    @Inject(CreateProductUseCase) private readonly create: CreateProductUseCase,
    @Inject(UpdateProductUseCase) private readonly update: UpdateProductUseCase,
    @Inject(ArchiveProductUseCase) private readonly archive: ArchiveProductUseCase,
    @Inject(RestoreProductUseCase) private readonly restore: RestoreProductUseCase,
    @Inject(AdjustStockUseCase) private readonly adjust: AdjustStockUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Todos os sabonetes, inclusive os fora da loja' })
  list() {
    return this.products.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const product = await this.products.get(id);
    if (!product) throw new ProductNotFoundForAdminError();
    return product;
  }

  @Post()
  @ApiOperation({ summary: 'Cria sabonete' })
  add(@Body() body: unknown) {
    return this.create.execute(productInputSchema.parse(body));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita sabonete (o estoque muda só por ajuste)' })
  edit(@Param('id') id: string, @Body() body: unknown) {
    return this.update.execute(id, productUpdateSchema.parse(body));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Tira da loja (arquiva, preserva o histórico)' })
  async remove(@Param('id') id: string) {
    await this.archive.execute(id);
    return { archived: true };
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desfaz a exclusão' })
  async undo(@Param('id') id: string) {
    await this.restore.execute(id);
    return { restored: true };
  }

  @Post(':id/stock-adjustments')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entrada ou saída de estoque' })
  async stock(@Param('id') id: string, @Body() body: unknown) {
    const stock = await this.adjust.execute(id, stockAdjustmentSchema.parse(body));
    return { stock };
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminCatalogSupportController {
  constructor(
    @Inject(CreateIngredientUseCase) private readonly ingredient: CreateIngredientUseCase,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStorage,
  ) {}

  @Post('ingredients')
  @ApiOperation({ summary: 'Cria ingrediente' })
  addIngredient(@Body() body: unknown) {
    return this.ingredient.execute(ingredientInputSchema.parse(body));
  }

  @Post('uploads')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Envia uma foto (JPG, PNG ou WebP até 5 MB)' })
  async upload(@UploadedFile() file?: { buffer: Buffer }) {
    const extension = file ? detectImageExtension(file.buffer) : null;
    if (!file || !extension) {
      throw new DomainError('Envie uma foto JPG, PNG ou WebP de até 5 MB.');
    }
    return this.storage.save(file.buffer, extension);
  }
}
