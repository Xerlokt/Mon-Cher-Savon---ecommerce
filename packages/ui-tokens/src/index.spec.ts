import { describe, expect, it } from 'vitest';
import { brand, colors } from './index.js';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('ui-tokens', () => {
  it('names the brand', () => expect(brand.name).toBe('Mon Cher Savon'));
  it.each(['sage700', 'terracotta600', 'ink900', 'success', 'warning', 'danger'] as const)(
    '%s passes WCAG AA on cream background',
    (token) => expect(contrast(colors[token], colors.cream50)).toBeGreaterThanOrEqual(4.5),
  );
});
