import { describe, expect, it } from 'vitest';
import { generatePublicCode } from './public-code.js';

describe('generatePublicCode', () => {
  it('generates unambiguous uppercase codes of the requested length', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePublicCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
    expect(generatePublicCode(10)).toHaveLength(10);
  });

  it('is not sequential', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generatePublicCode()));
    expect(codes.size).toBeGreaterThan(95);
  });
});
