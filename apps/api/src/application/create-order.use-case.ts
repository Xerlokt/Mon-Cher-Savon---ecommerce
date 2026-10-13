import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/shared/domain-error.js';
import { Cep } from '../domain/shared/cep.js';
import { Money } from '../domain/shared/money.js';
import { Order, type Customer } from '../domain/order/order.js';
import type { OrderRepository, PaymentGateway, ProductReader } from '../domain/ports/index.js';

export type ShippingOption = 'PICKUP' | 'LOCAL' | 'SHIPPING';
export type ShippingTable = Record<ShippingOption, number>;

export interface CreateOrderInput {
  items: Array<{ productId: string; quantity: number }>;
  customer: Customer;
  address: {
    cep: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    complement?: string;
  };
  shippingOption: ShippingOption;
  paymentMethod: 'PIX' | 'CARD';
}

export interface CreateOrderResult {
  orderId: string;
  publicCode: string;
  totalCents: number;
  payment: { providerPaymentId: string; pixCopyPaste?: string; pixQrCodeBase64?: string };
}

export class CreateOrderUseCase {
  constructor(
    private readonly products: ProductReader,
    private readonly orders: OrderRepository,
    private readonly gateway: PaymentGateway,
    private readonly shippingTable: ShippingTable,
    private readonly publicCode: () => string,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderResult> {
    const found = await this.products.findByIds(input.items.map((i) => i.productId));
    const items = input.items.map((line) => {
      const product = found.find((p) => p.id === line.productId);
      if (!product || product.status !== 'ACTIVE') {
        throw new DomainError(`Produto ${line.productId} não encontrado`);
      }
      if (line.quantity > product.stock) {
        throw new DomainError(`Estoque insuficiente para ${product.name}`);
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: line.quantity,
      };
    });

    const order = Order.create({
      id: randomUUID(),
      publicCode: this.publicCode(),
      items,
      shipping: Money.cents(this.shippingTable[input.shippingOption]),
      customer: input.customer,
      address: { ...input.address, cep: Cep.of(input.address.cep) },
    });
    await this.orders.save(order);

    const payment = await this.gateway.createPayment({
      orderId: order.id,
      amountCents: order.total.cents,
      method: input.paymentMethod,
      payerEmail: input.customer.email,
    });
    return {
      orderId: order.id,
      publicCode: order.publicCode,
      totalCents: order.total.cents,
      payment,
    };
  }
}
