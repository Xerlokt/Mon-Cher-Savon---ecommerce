'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import {
  cartCount,
  cartReducer,
  cartSubtotal,
  loadCart,
  saveCart,
  type CartAction,
  type CartItem,
} from './cart';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  hydrated: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  dispatch: (action: CartAction) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      dispatch({ type: 'hydrate', state: loadCart(window.localStorage) });
    } catch {
      // localStorage unavailable: start empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveCart(state, window.localStorage);
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      count: cartCount(state),
      subtotalCents: cartSubtotal(state),
      hydrated,
      open,
      setOpen,
      dispatch,
    }),
    [state, hydrated, open],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
