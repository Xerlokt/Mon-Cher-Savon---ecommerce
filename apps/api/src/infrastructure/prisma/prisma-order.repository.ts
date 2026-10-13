import type { Prisma } from '@prisma/client';
import { Order } from '../../domain/order/order.js';
import type { OrderRepository } from '../../domain/ports/index.js';
import { Cep } from '../../domain/shared/cep.js';
import { Money } from '../../domain/shared/money.js';
import type { DbProvider } from './transactional-db.js';

type Row = Prisma.OrderGetPayload<{ include: { items: true } }>;

const toDomain = (row: Row): Order =>
  Order.create({
    id: row.id,
    publicCode: row.publicCode,
    status: row.status,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    shipping: Money.cents(row.shippingCents),
    customer: { name: row.customerName, phone: row.phone, email: row.email },
    address: {
      cep: Cep.of(row.cep),
      street: row.street,
      number: row.number,
      district: row.district,
      city: row.city,
      state: row.state,
      ...(row.complement ? { complement: row.complement } : {}),
    },
    items: row.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: Money.cents(i.unitPriceCents),
      quantity: i.quantity,
    })),
  });

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly provider: DbProvider) {}

  async save(order: Order): Promise<void> {
    await this.provider.db.order.upsert({
      where: { id: order.id },
      update: { status: order.status, paidAt: order.paidAt },
      create: {
        id: order.id,
        publicCode: order.publicCode,
        status: order.status,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        customerName: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
        cep: order.address.cep.digits,
        street: order.address.street,
        number: order.address.number,
        district: order.address.district,
        city: order.address.city,
        state: order.address.state,
        complement: order.address.complement ?? null,
        shippingCents: order.shipping.cents,
        items: {
          create: order.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            unitPriceCents: i.unitPrice.cents,
            quantity: i.quantity,
          })),
        },
      },
    });
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.provider.db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByPublicCode(code: string): Promise<Order | null> {
    const row = await this.provider.db.order.findUnique({
      where: { publicCode: code },
      include: { items: true },
    });
    return row ? toDomain(row) : null;
  }

  async findAwaitingPaymentCreatedBefore(date: Date): Promise<Order[]> {
    const rows = await this.provider.db.order.findMany({
      where: { status: 'AWAITING_PAYMENT', createdAt: { lt: date } },
      include: { items: true },
    });
    return rows.map(toDomain);
  }
}
