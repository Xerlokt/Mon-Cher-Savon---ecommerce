'use client';

import type { OrderStatusResponse } from '@mon-cher-savon/contracts';
import { useEffect, useState } from 'react';
import { fetchOrderStatus as defaultFetch } from '@/features/checkout/api';
import { pixStorageKey } from '@/features/checkout/checkout-form';
import { formatPrice } from '@/shared/format';

interface PixData {
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
}

const COPY: Record<OrderStatusResponse['status'], { title: string; text: string }> = {
  AWAITING_PAYMENT: {
    title: 'Aguardando o pagamento',
    text: 'Pague o Pix abaixo. Assim que o banco confirmar, esta página atualiza sozinha.',
  },
  PAID: {
    title: 'Pedido confirmado!',
    text: 'Recebemos o seu pagamento. A artesã já está preparando o seu pedido.',
  },
  SHIPPED: { title: 'Pedido enviado', text: 'Seu pedido está a caminho.' },
  DELIVERED: { title: 'Pedido entregue', text: 'Esperamos que você ame os seus sabonetes.' },
  CANCELLED: {
    title: 'Pedido cancelado',
    text: 'O pagamento não foi confirmado a tempo. Você pode fazer um novo pedido quando quiser.',
  },
};

function readPix(code: string): PixData | null {
  try {
    const raw = window.sessionStorage.getItem(pixStorageKey(code));
    return raw ? (JSON.parse(raw) as PixData) : null;
  } catch {
    return null;
  }
}

interface Props {
  initial: OrderStatusResponse;
  fetchStatus?: (code: string) => Promise<OrderStatusResponse | null>;
  intervalMs?: number;
}

export function OrderTracker({ initial, fetchStatus = defaultFetch, intervalMs = 5000 }: Props) {
  const [order, setOrder] = useState(initial);
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setPix(readPix(initial.publicCode)), [initial.publicCode]);

  useEffect(() => {
    if (order.status !== 'AWAITING_PAYMENT') return;
    const timer = setInterval(async () => {
      const next = await fetchStatus(order.publicCode).catch(() => null);
      if (next) setOrder(next);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [order.status, order.publicCode, fetchStatus, intervalMs]);

  async function copy() {
    if (!pix?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(pix.pixCopyPaste);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const copy_ = COPY[order.status];
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2 text-center" aria-live="polite">
        <p className="text-sm">Pedido #{order.publicCode}</p>
        <h1 className="text-3xl text-sage-700">{copy_.title}</h1>
        <p>{copy_.text}</p>
      </header>

      {order.status === 'AWAITING_PAYMENT' ? (
        <section
          aria-labelledby="pix"
          className="space-y-4 rounded-card bg-clay-100 p-6 shadow-soft"
        >
          <h2 id="pix" className="font-heading text-xl text-sage-700">
            Pague com Pix
          </h2>
          {pix?.pixQrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${pix.pixQrCodeBase64}`}
              alt="QR Code do Pix"
              width={240}
              height={240}
              className="mx-auto rounded-lg bg-white p-2"
            />
          ) : null}
          {pix?.pixCopyPaste ? (
            <>
              <p className="break-all rounded-lg bg-white p-3 text-sm">{pix.pixCopyPaste}</p>
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-700 text-lg font-semibold text-cream-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600"
              >
                {copied ? 'Código copiado!' : 'Copiar código Pix'}
              </button>
            </>
          ) : (
            <p>
              Não encontramos o código Pix neste aparelho. Guarde o número do pedido e fale com a
              artesã.
            </p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="itens" className="space-y-2 rounded-card bg-white p-6 shadow-soft">
        <h2 id="itens" className="font-heading text-xl text-sage-700">
          Itens
        </h2>
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.productName} className="flex justify-between gap-3">
              <span>
                {item.quantity}x {item.productName}
              </span>
              <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-clay-100 pt-2">
          <span>Frete</span>
          <span>{order.shippingCents === 0 ? 'Grátis' : formatPrice(order.shippingCents)}</span>
        </p>
        <p className="flex justify-between text-lg">
          <strong>Total</strong>
          <strong>{formatPrice(order.totalCents)}</strong>
        </p>
      </section>
    </div>
  );
}
