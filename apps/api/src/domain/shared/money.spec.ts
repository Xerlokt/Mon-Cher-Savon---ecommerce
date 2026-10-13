import { describe, expect, it } from 'vitest';
import { Money } from './money.js';

describe('Money', () => {
  it('adds and multiplies in cents', () => {
    expect(Money.cents(1800).times(2).plus(Money.cents(1000)).cents).toBe(4600);
  });
  it('rejects fractional or negative cents', () => {
    expect(() => Money.cents(1.5)).toThrow();
    expect(() => Money.cents(-1)).toThrow();
  });
  it('formats as BRL', () => {
    expect(Money.cents(6800).format().replace(/\s/g, ' ')).toBe('R$ 68,00');
  });
  it('compares', () => {
    expect(Money.cents(10).equals(Money.cents(10))).toBe(true);
    expect(Money.zero().cents).toBe(0);
  });
});
