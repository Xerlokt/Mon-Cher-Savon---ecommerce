import { describe, expect, it } from 'vitest';
import { InvalidOrderTransitionError, OrderNotPaidError } from './errors.js';
import { Money } from '../shared/money.js';
import { anOrder } from './testing/order.builder.js';

describe('Order', () => {
  it('soma itens e frete no total', () => {
    const order = anOrder()
      .withItem({ unitPrice: Money.cents(1800), quantity: 2 })
      .withShipping(Money.cents(1000))
      .build();
    expect(order.total.cents).toBe(4600);
    expect(order.subtotal.cents).toBe(3600);
  });

  it('não deixa enviar pedido ainda não pago', () => {
    const order = anOrder().pendingPayment().build();
    expect(() => order.markAsShipped()).toThrow(OrderNotPaidError);
  });

  it('percorre o ciclo feliz e emite OrderPaid', () => {
    const order = anOrder().pendingPayment().build();
    order.markAsPaid(new Date('2026-01-01'));
    expect(order.status).toBe('PAID');
    expect(order.paidAt).toEqual(new Date('2026-01-01'));
    expect(order.pullEvents()).toEqual([
      expect.objectContaining({ type: 'OrderPaid', orderId: order.id }),
    ]);
    expect(order.pullEvents()).toEqual([]);
    order.markAsShipped();
    order.markAsDelivered();
    expect(order.status).toBe('DELIVERED');
  });

  it('cancela a partir de aguardando ou pago, mas não depois de enviado', () => {
    const a = anOrder().pendingPayment().build();
    a.cancel();
    expect(a.status).toBe('CANCELLED');
    const b = anOrder().paid().build();
    b.cancel();
    expect(b.status).toBe('CANCELLED');
    const c = anOrder().paid().build();
    c.markAsShipped();
    expect(() => c.cancel()).toThrow(InvalidOrderTransitionError);
  });

  it('devolve o dinheiro de um pedido pago, enviado ou entregue', () => {
    for (const build of [
      () => anOrder().paid().build(),
      () => anOrder().shipped().build(),
      () => anOrder().delivered().build(),
    ]) {
      const order = build();
      expect(order.isRefundable).toBe(true);
      order.refund();
      expect(order.status).toBe('REFUNDED');
    }
  });

  it('não reembolsa o que não foi pago, foi cancelado ou já foi reembolsado', () => {
    for (const build of [
      () => anOrder().pendingPayment().build(),
      () => anOrder().cancelled().build(),
    ]) {
      const order = build();
      expect(order.isRefundable).toBe(false);
      expect(() => order.refund()).toThrow(InvalidOrderTransitionError);
    }
    const done = anOrder().paid().build();
    done.refund();
    expect(() => done.refund()).toThrow(InvalidOrderTransitionError);
    expect(() => done.cancel()).toThrow(InvalidOrderTransitionError);
  });

  it('rejeita transições inválidas', () => {
    const order = anOrder().paid().build();
    expect(() => order.markAsPaid()).toThrow(InvalidOrderTransitionError);
    expect(() => order.markAsDelivered()).toThrow(InvalidOrderTransitionError);
    const pending = anOrder().pendingPayment().build();
    expect(() => pending.markAsDelivered()).toThrow(InvalidOrderTransitionError);
  });

  it('exige ao menos um item e quantidade positiva', () => {
    expect(() => anOrder().withoutItems().build()).toThrow();
    expect(() =>
      anOrder()
        .withItem({ unitPrice: Money.cents(1), quantity: 0 })
        .build(),
    ).toThrow();
  });
});
