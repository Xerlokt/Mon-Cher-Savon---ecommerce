import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AdminOrderDetail,
  AdminOrderSummary,
  AdminProductView,
} from '@mon-cher-savon/contracts';
import type {
  AdminOrderQuery,
  AdminProductRepository,
  AdminUserRepository,
  IngredientView,
} from '../../domain/ports/index.js';

export class PrismaAdminUsers implements AdminUserRepository {
  constructor(private readonly db: PrismaClient) {}

  findByEmail(email: string) {
    return this.db.adminUser.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.db.adminUser.findUnique({ where: { id } });
  }
}

type OrderRow = Prisma.OrderGetPayload<{ include: { items: true } }>;

const orderTotal = (o: OrderRow): number =>
  o.shippingCents + o.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

const toSummary = (o: OrderRow): AdminOrderSummary => ({
  id: o.id,
  publicCode: o.publicCode,
  status: o.status,
  customerName: o.customerName,
  totalCents: orderTotal(o),
  itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
  createdAt: o.createdAt.toISOString(),
  paidAt: o.paidAt?.toISOString() ?? null,
});

export class PrismaAdminOrderQuery implements AdminOrderQuery {
  constructor(private readonly db: PrismaClient) {}

  async list(status?: string): Promise<AdminOrderSummary[]> {
    const rows = await this.db.order.findMany({
      where: status ? { status: status as OrderRow['status'] } : {},
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toSummary);
  }

  async getByPublicCode(code: string): Promise<AdminOrderDetail | null> {
    const row = await this.db.order.findUnique({
      where: { publicCode: code },
      include: { items: true },
    });
    if (!row) return null;
    return {
      ...toSummary(row),
      phone: row.phone,
      email: row.email,
      address: {
        cep: row.cep,
        street: row.street,
        number: row.number,
        district: row.district,
        city: row.city,
        state: row.state,
        complement: row.complement,
      },
      shippingCents: row.shippingCents,
      items: row.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
    };
  }
}

type ProductRow = Prisma.ProductGetPayload<{ include: { ingredients: true } }>;

const toView = (p: ProductRow): AdminProductView => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  description: p.description,
  usage: p.usage,
  aroma: p.aroma,
  priceCents: p.priceCents,
  weightGrams: p.weightGrams,
  stock: p.stock,
  lowStockThreshold: p.lowStockThreshold,
  lowStock: p.stock <= p.lowStockThreshold,
  status: p.status,
  images: p.images,
  ingredientIds: p.ingredients.map((i) => i.ingredientId),
});

export class PrismaAdminProductRepository implements AdminProductRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<AdminProductView[]> {
    const rows = await this.db.product.findMany({
      include: { ingredients: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toView);
  }

  async get(id: string): Promise<AdminProductView | null> {
    const row = await this.db.product.findUnique({ where: { id }, include: { ingredients: true } });
    return row ? toView(row) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.db.product.count({ where: { slug } })) > 0;
  }

  async create(data: Parameters<AdminProductRepository['create']>[0]): Promise<AdminProductView> {
    const { ingredientIds, ...rest } = data;
    const row = await this.db.product.create({
      data: {
        ...rest,
        ingredients: { create: ingredientIds.map((ingredientId) => ({ ingredientId })) },
      },
      include: { ingredients: true },
    });
    return toView(row);
  }

  async update(
    id: string,
    patch: Parameters<AdminProductRepository['update']>[1],
  ): Promise<AdminProductView | null> {
    const { ingredientIds, ...rest } = patch;
    try {
      const row = await this.db.product.update({
        where: { id },
        data: {
          ...rest,
          ...(ingredientIds
            ? {
                ingredients: {
                  deleteMany: {},
                  create: ingredientIds.map((ingredientId) => ({ ingredientId })),
                },
              }
            : {}),
        },
        include: { ingredients: true },
      });
      return toView(row);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') return null;
      throw error;
    }
  }

  async setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED'): Promise<boolean> {
    const { count } = await this.db.product.updateMany({ where: { id }, data: { status } });
    return count === 1;
  }

  async createIngredient(data: {
    name: string;
    slug: string;
    benefit: string;
  }): Promise<IngredientView> {
    return this.db.ingredient.create({ data });
  }

  async slugExistsIngredient(slug: string): Promise<boolean> {
    return (await this.db.ingredient.count({ where: { slug } })) > 0;
  }
}
