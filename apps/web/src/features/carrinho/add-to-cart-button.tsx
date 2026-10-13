'use client';

import { useCart } from './cart-provider';
import type { CartItem } from './cart';

export function AddToCartButton({
  product,
  soldOut,
}: {
  product: Omit<CartItem, 'quantity'>;
  soldOut: boolean;
}) {
  const { dispatch, setOpen } = useCart();
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => {
        dispatch({ type: 'add', item: product });
        setOpen(true);
      }}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-terracotta-600 px-8 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:cursor-not-allowed disabled:bg-ink-900/40 sm:w-auto"
    >
      {soldOut ? 'Esgotado' : 'Adicionar ao carrinho'}
    </button>
  );
}
