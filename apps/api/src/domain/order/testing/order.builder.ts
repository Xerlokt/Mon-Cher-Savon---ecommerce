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
      id: 'o1',
      publicCode: 'A7K2',
      status: this.status,
      items: this.items,
      shipping: this.shipping,
    });
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
