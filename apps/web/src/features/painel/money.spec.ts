import { describe, expect, it } from 'vitest';
import { centsToInput, parsePriceToCents } from './money';

describe('parsePriceToCents', () => {
  it.each([
    ['18', 1800],
    ['18,5', 1850],
    ['18,50', 1850],
    ['R$ 18,50', 1850],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['18.50', 1850],
    ['0,99', 99],
  ])('parses %s as %i cents', (text, cents) => {
    expect(parsePriceToCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '0', '0,00', '-5', '18,555', '1,2,3', '12a'])('rejects %j', (text) => {
    expect(parsePriceToCents(text)).toBeNull();
  });
});

describe('centsToInput', () => {
  it('formats with a decimal comma', () => {
    expect(centsToInput(1850)).toBe('18,50');
    expect(centsToInput(2000)).toBe('20,00');
    expect(centsToInput(5)).toBe('0,05');
  });
});
