import { describe, expect, it } from 'vitest';
import { formatPrice } from './format';

describe('formatPrice', () => {
  it('formats cents as BRL', () => {
    expect(formatPrice(1800).replace(/\s/g, ' ')).toBe('R$ 18,00');
    expect(formatPrice(6850).replace(/\s/g, ' ')).toBe('R$ 68,50');
  });
});
