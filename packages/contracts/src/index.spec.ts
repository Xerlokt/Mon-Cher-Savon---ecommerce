import { describe, expect, it } from 'vitest';
import { cepSchema, orderStatusSchema } from './index.js';

describe('contracts', () => {
  it('accepts CEP with and without hyphen', () => {
    expect(cepSchema.safeParse('01310-100').success).toBe(true);
    expect(cepSchema.safeParse('01310100').success).toBe(true);
    expect(cepSchema.safeParse('123').success).toBe(false);
  });
  it('rejects unknown status', () => {
    expect(orderStatusSchema.safeParse('LOST').success).toBe(false);
  });
});
