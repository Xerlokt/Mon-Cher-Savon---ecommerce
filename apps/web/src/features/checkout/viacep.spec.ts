import { describe, expect, it, vi } from 'vitest';
import { lookupCep } from './viacep';

const response = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

describe('lookupCep', () => {
  it('returns the address for a valid CEP', async () => {
    const fetchImpl = response({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
    const address = await lookupCep('01310-100', fetchImpl);
    expect(address).toEqual({
      street: 'Avenida Paulista',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
  });

  it('returns null for unknown CEPs, bad input and network failures', async () => {
    expect(await lookupCep('00000-000', response({ erro: true }))).toBeNull();
    expect(await lookupCep('123', response({}))).toBeNull();
    expect(await lookupCep('01310100', response({}, false))).toBeNull();
    expect(await lookupCep('01310100', vi.fn().mockRejectedValue(new Error('offline')))).toBeNull();
  });
});
