import { describe, expect, it } from 'vitest';
import { Cep } from './cep.js';

describe('Cep', () => {
  it('normalizes and formats', () => {
    const cep = Cep.of('01310-100');
    expect(cep.digits).toBe('01310100');
    expect(cep.formatted).toBe('01310-100');
  });
  it('rejects invalid values', () => {
    expect(() => Cep.of('123')).toThrow();
    expect(() => Cep.of('abcdefgh')).toThrow();
  });
});
