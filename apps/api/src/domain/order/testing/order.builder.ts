import { Cep } from '../../shared/cep.js';
import { Money } from '../../shared/money.js';
import { Order, type OrderItem, type OrderStatus } from '../order.js';

export class OrderBuilder {
  private items: OrderItem[] = [
    {
      productId: 'p1',
      productName: 'Sabonete de Lavanda',
      unitPrice: Money.cents(1800),
      quantity: 1,
    },
  ];
  private shipping = Money.zero();
  private status: OrderStatus = 'AWAITING_PAYMENT';
  private customItems = false;
  private id = 'o1';
  private created = new Date();

  withItem(item: {
    unitPrice: Money;
    quantity: number;
    productId?: string;
    productName?: string;
  }): this {
    if (!this.customItems) {
      this.items = [];
      this.customItems = true;
    }
    this.items.push({
      productId: item.productId ?? 'p1',
      productName: item.productName ?? 'Sabonete de Lavanda',
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    });
    return this;
  }

  withoutItems(): this {
    this.items = [];
    this.customItems = true;
    return this;
  }

  withShipping(shipping: Money): this {
    this.shipping = shipping;
    return this;
  }

  withId(id: string): this {
    this.id = id;
    return this;
  }

  createdAt(date: Date): this {
    this.created = date;
    return this;
  }

  pendingPayment(): this {
    this.status = 'AWAITING_PAYMENT';
    return this;
  }

  paid(): this {
    this.status = 'PAID';
    return this;
  }

  build(): Order {
    return Order.create({
      id: this.id,
      publicCode: 'A7K2',
      status: this.status,
      items: this.items,
      shipping: this.shipping,
      createdAt: this.created,
      customer: { name: 'Maria Souza', phone: '11900000000', email: 'maria@example.com' },
      address: {
        cep: Cep.of('01310-100'),
        street: 'Rua das Flores',
        number: '120',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        complement: 'ap. 3',
      },
    });
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
