import { DomainError } from '../shared/domain-error.js';

export class OrderNotPaidError extends DomainError {
  constructor() {
    super('Pedido ainda não foi pago');
  }
}

export class InvalidOrderTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Transição inválida: ${from} → ${to}`);
  }
}
