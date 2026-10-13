import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from './mercadopago.signature.js';

const secret = 'whsec_test';
const now = 1_760_000_000_000;

const sign = (dataId: string, requestId: string, ts: number, key = secret) =>
  createHmac('sha256', key).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');

describe('verifyMercadoPagoSignature', () => {
  it('accepts a valid signature', () => {
    const header = `ts=${now},v1=${sign('123456', 'req-1', now)}`;
    expect(
      verifyMercadoPagoSignature({
        secret,
        xSignature: header,
        xRequestId: 'req-1',
        dataId: '123456',
        now,
      }),
    ).toBe(true);
  });

  it('lowercases alphanumeric data ids like the provider does', () => {
    const header = `ts=${now},v1=${sign('abc123', 'req-1', now)}`;
    expect(
      verifyMercadoPagoSignature({
        secret,
        xSignature: header,
        xRequestId: 'req-1',
        dataId: 'ABC123',
        now,
      }),
    ).toBe(true);
  });

  it.each([
    ['wrong secret', `ts=${now},v1=${sign('1', 'r', now, 'other')}`, 'r', '1'],
    ['tampered id', `ts=${now},v1=${sign('1', 'r', now)}`, 'r', '2'],
    ['tampered request id', `ts=${now},v1=${sign('1', 'r', now)}`, 'x', '1'],
    ['stale timestamp', `ts=${now - 3_600_000},v1=${sign('1', 'r', now - 3_600_000)}`, 'r', '1'],
    ['malformed header', 'garbage', 'r', '1'],
    ['missing v1', `ts=${now}`, 'r', '1'],
    ['non numeric ts', `ts=abc,v1=${sign('1', 'r', now)}`, 'r', '1'],
    ['short digest', `ts=${now},v1=abcd`, 'r', '1'],
  ])('rejects %s', (_name, header, requestId, dataId) => {
    expect(
      verifyMercadoPagoSignature({
        secret,
        xSignature: header,
        xRequestId: requestId,
        dataId,
        now,
      }),
    ).toBe(false);
  });

  it('rejects missing headers or ids', () => {
    expect(
      verifyMercadoPagoSignature({
        secret,
        xSignature: undefined,
        xRequestId: 'r',
        dataId: '1',
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        secret,
        xSignature: 'ts=1,v1=a',
        xRequestId: undefined,
        dataId: '1',
      }),
    ).toBe(false);
  });
});
