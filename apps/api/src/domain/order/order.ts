import { DomainError } from '../shared/domain-error.js';
import type { Cep } from '../shared/cep.js';
import { Money } from '../shared/money.js';
import type { OrderPaid } from '../events/order-paid.js';
import { InvalidOrderTransitionError, OrderNotPaidError } from './errors.js';

export type OrderStatus =
  'AWAITING_PAYMENT' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: Money;
  quantity: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
}

export interface Address {
  cep: Cep;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  complement?: string;
}

export interface OrderProps {
  customer: Customer;
  address: Address;
  id: string;
  publicCode: string;
  status?: OrderStatus;
  items: OrderItem[];
  shipping: Money;
  paidAt?: Date | null;
  createdAt?: Date;
}

export class Order {
  private events: OrderPaid[] = [];

  private constructor(
    readonly id: string,
    readonly publicCode: string,
    private _status: OrderStatus,
    readonly items: readonly OrderItem[],
    readonly shipping: Money,
    private _paidAt: Date | null,
    readonly customer: Customer,
    readonly address: Address,
    readonly createdAt: Date,
  ) {}

  static create(props: OrderProps): Order {
    if (props.items.length === 0) throw new DomainError('Pedido precisa de ao menos um item');
    if (props.items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      throw new DomainError('Quantidade deve ser um inteiro positivo');
    }
    return new Order(
      props.id,
      props.publicCode,
      props.status ?? 'AWAITING_PAYMENT',
      props.items,
      props.shipping,
      props.paidAt ?? null,
      props.customer,
      props.address,
      props.createdAt ?? new Date(),
    );
  }

  get status(): OrderStatus {
    return this._status;
  }
  get paidAt(): Date | null {
    return this._paidAt;
  }
  get subtotal(): Money {
    return this.items.reduce((sum, i) => sum.plus(i.unitPrice.times(i.quantity)), Money.zero());
  }
  get total(): Money {
    return this.subtotal.plus(this.shipping);
  }

  markAsPaid(at: Date = new Date()): void {
    this.transition('AWAITING_PAYMENT', 'PAID');
    this._paidAt = at;
    this.events.push({
      type: 'OrderPaid',
      orderId: this.id,
      publicCode: this.publicCode,
      occurredAt: at,
    });
  }

  markAsShipped(): void {
    if (this._status === 'AWAITING_PAYMENT') throw new OrderNotPaidError();
    this.transition('PAID', 'SHIPPED');
  }

  markAsDelivered(): void {
    this.transition('SHIPPED', 'DELIVERED');
  }

  cancel(): void {
    if (this._status !== 'AWAITING_PAYMENT' && this._status !== 'PAID') {
      throw new InvalidOrderTransitionError(this._status, 'CANCELLED');
    }
    this._status = 'CANCELLED';
  }

  /** Money was paid, so it can be given back: before shipping, in transit or after delivery. */
  get isRefundable(): boolean {
    return this._status === 'PAID' || this._status === 'SHIPPED' || this._status === 'DELIVERED';
  }

  refund(): void {
    if (!this.isRefundable) throw new InvalidOrderTransitionError(this._status, 'REFUNDED');
    this._status = 'REFUNDED';
  }

  pullEvents(): OrderPaid[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }

  private transition(expected: OrderStatus, next: OrderStatus): void {
    if (this._status !== expected) throw new InvalidOrderTransitionError(this._status, next);
    this._status = next;
  }
}
