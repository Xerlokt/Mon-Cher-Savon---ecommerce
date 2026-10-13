'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/shared/format';
import { apiBase } from '@/shared/api-url';
import { useCart } from './cart-provider';

/** Product ids that are sold out or no longer sold, according to the API. */
function useUnavailable(enabled: boolean, ids: string[]): Set<string> {
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    let cancelled = false;
    fetch(`${apiBase()}/api/v1/products`)
      .then((res) => (res.ok ? res.json() : null))
      .then((list: Array<{ id: string; soldOut: boolean }> | null) => {
        if (cancelled || !list) return;
        const available = new Set(list.filter((p) => !p.soldOut).map((p) => p.id));
        setUnavailable(new Set(ids.filter((id) => !available.has(id))));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);
  return unavailable;
}

const iconButton =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-sage-400 text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700';

export function CartLauncher() {
  const { count, open, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
    >
      <ShoppingBag aria-hidden size={22} />
      <span>Carrinho</span>
      <span aria-label={`${count} ${count === 1 ? 'item' : 'itens'} no carrinho`}>
        <span
          aria-hidden
          className="rounded-full bg-terracotta-600 px-2 py-0.5 text-sm text-cream-50"
        >
          {count}
        </span>
      </span>
    </button>
  );
}

/** Sticky bar for phones: total and a way to open the cart. */
export function CartBottomBar() {
  const { count, subtotalCents, setOpen, hydrated } = useCart();
  if (!hydrated || count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-clay-100 bg-cream-50 p-3 shadow-soft md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-between rounded-full bg-sage-700 px-6 text-cream-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600"
      >
        <span>Ver carrinho ({count})</span>
        <span className="font-bold">{formatPrice(subtotalCents)}</span>
      </button>
    </div>
  );
}

export function CartDrawer() {
  const { items, subtotalCents, open, setOpen, dispatch } = useCart();
  const unavailable = useUnavailable(
    open,
    items.map((i) => i.productId),
  );
  const blocked = items.some((i) => unavailable.has(i.productId));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream-50 shadow-soft focus:outline-none">
          <div className="flex items-center justify-between border-b border-clay-100 p-4">
            <Dialog.Title className="font-heading text-2xl text-sage-700">
              Seu carrinho
            </Dialog.Title>
            <Dialog.Close className={iconButton} aria-label="Fechar carrinho">
              <X aria-hidden size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Revise os sabonetes escolhidos antes de finalizar a compra.
          </Dialog.Description>

          {items.length === 0 ? (
            <div className="flex-1 p-6">
              <p>Seu carrinho está vazio.</p>
              <Link
                href="/catalogo"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex min-h-11 items-center text-terracotta-600 underline"
              >
                Ver sabonetes
              </Link>
            </div>
          ) : (
            <ul className="flex-1 space-y-4 overflow-y-auto p-4">
              {items.map((item) => (
                <li key={item.productId} className="rounded-card bg-clay-100 p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-heading text-lg text-sage-700">{item.name}</p>
                    <p className="font-bold text-terracotta-600">
                      {formatPrice(item.priceCents * item.quantity)}
                    </p>
                  </div>
                  {unavailable.has(item.productId) ? (
                    <p role="alert" className="mt-1 text-sm font-semibold text-danger">
                      Este sabonete esgotou. Remova para continuar.
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Diminuir quantidade de ${item.name}`}
                      onClick={() =>
                        dispatch({
                          type: 'setQuantity',
                          productId: item.productId,
                          quantity: item.quantity - 1,
                        })
                      }
                    >
                      <Minus aria-hidden size={18} />
                    </button>
                    <span className="min-w-8 text-center text-lg" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Aumentar quantidade de ${item.name}`}
                      onClick={() =>
                        dispatch({
                          type: 'setQuantity',
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      }
                    >
                      <Plus aria-hidden size={18} />
                    </button>
                    <button
                      type="button"
                      className={`${iconButton} ml-auto border-danger text-danger`}
                      aria-label={`Remover ${item.name}`}
                      onClick={() => dispatch({ type: 'remove', productId: item.productId })}
                    >
                      <Trash2 aria-hidden size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 ? (
            <div className="space-y-3 border-t border-clay-100 p-4">
              <p className="flex justify-between text-lg">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotalCents)}</strong>
              </p>
              <p className="text-sm">O frete é calculado na próxima etapa.</p>
              {blocked ? (
                <p className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink-900/30 text-lg font-semibold">
                  Remova os itens esgotados
                </p>
              ) : (
                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-terracotta-600 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
                >
                  Finalizar compra
                </Link>
              )}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
