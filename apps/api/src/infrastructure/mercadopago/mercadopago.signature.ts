import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignatureInput {
  secret: string;
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  now?: number;
  toleranceMs?: number;
}

/**
 * Validates the `x-signature` header sent by Mercado Pago webhooks.
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` signed with HMAC-SHA256.
 */
export function verifyMercadoPagoSignature(input: SignatureInput): boolean {
  const { secret, xSignature, xRequestId, dataId } = input;
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  ) as Record<string, string | undefined>;
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const tolerance = input.toleranceMs ?? 10 * 60_000;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(Number(ts)) || Math.abs(now - Number(ts)) > tolerance) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
