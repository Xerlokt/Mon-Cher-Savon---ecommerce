import { DomainError } from './domain-error.js';

export class Money {
  private constructor(readonly cents: number) {}

  static cents(value: number): Money {
    if (!Number.isInteger(value) || value < 0) {
      throw new DomainError('Valor em centavos deve ser inteiro e não negativo');
    }
    return new Money(value);
  }

  static zero(): Money {
    return new Money(0);
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  times(quantity: number): Money {
    return Money.cents(this.cents * quantity);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  format(): string {
    return (this.cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
