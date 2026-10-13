import { DomainError } from './domain-error.js';

export class Cep {
  private constructor(readonly digits: string) {}

  static of(raw: string): Cep {
    if (!/^\d{5}-?\d{3}$/.test(raw)) throw new DomainError('CEP inválido');
    return new Cep(raw.replace('-', ''));
  }

  get formatted(): string {
    return `${this.digits.slice(0, 5)}-${this.digits.slice(5)}`;
  }
}
