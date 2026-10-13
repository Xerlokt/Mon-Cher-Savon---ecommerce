import { describe, expect, it } from 'vitest';
import {
  cartCount,
  cartReducer,
  cartSubtotal,
  loadCart,
  saveCart,
  type CartItem,
  type CartState,
} from './cart';

const lavanda: Omit<CartItem, 'quantity'> = {
  productId: 'p1',
  slug: 'lavanda',
  name: 'Lavanda',
  priceCents: 1800,
  imageUrl: null,
};

const empty: CartState = { items: [] };

describe('cartReducer', () => {
  it('adds a new item and merges quantities for the same product', () => {
    let state = cartReducer(empty, { type: 'add', item: lavanda });
    state = cartReducer(state, { type: 'add', item: lavanda, quantity: 2 });
    expect(state.items).toEqual([{ ...lavanda, quantity: 3 }]);
  });

  it('caps quantity at 20', () => {
    const state = cartReducer(empty, { type: 'add', item: lavanda, quantity: 50 });
    expect(state.items[0]?.quantity).toBe(20);
  });

  it('sets quantity and removes the item when it reaches zero', () => {
    let state = cartReducer(empty, { type: 'add', item: lavanda });
    state = cartReducer(state, { type: 'setQuantity', productId: 'p1', quantity: 4 });
    expect(state.items[0]?.quantity).toBe(4);
    state = cartReducer(state, { type: 'setQuantity', productId: 'p1', quantity: 0 });
    expect(state.items).toEqual([]);
  });

  it('removes and clears', () => {
    let state = cartReducer(empty, { type: 'add', item: lavanda });
    state = cartReducer(state, { type: 'remove', productId: 'p1' });
    expect(state.items).toEqual([]);
    state = cartReducer({ items: [{ ...lavanda, quantity: 1 }] }, { type: 'clear' });
    expect(state.items).toEqual([]);
  });

  it('replaces the whole state on hydrate', () => {
    const state = cartReducer(empty, {
      type: 'hydrate',
      state: { items: [{ ...lavanda, quantity: 2 }] },
    });
    expect(cartCount(state)).toBe(2);
  });
});

describe('selectors', () => {
  it('computes count and subtotal', () => {
    const state: CartState = {
      items: [
        { ...lavanda, quantity: 2 },
        { ...lavanda, productId: 'p2', priceCents: 2200, quantity: 1 },
      ],
    };
    expect(cartCount(state)).toBe(3);
    expect(cartSubtotal(state)).toBe(5800);
  });
});

describe('storage', () => {
  const makeStorage = (initial?: string) => {
    let value = initial ?? null;
    return {
      getItem: () => value,
      setItem: (_k: string, v: string) => {
        value = v;
      },
    };
  };

  it('round-trips through storage', () => {
    const storage = makeStorage();
    saveCart({ items: [{ ...lavanda, quantity: 2 }] }, storage);
    expect(loadCart(storage).items[0]?.quantity).toBe(2);
  });

  it('ignores corrupted or invalid data', () => {
    expect(loadCart(makeStorage('not json')).items).toEqual([]);
    expect(loadCart(makeStorage('{"items":[{"productId":1}]}')).items).toEqual([]);
    expect(loadCart(makeStorage()).items).toEqual([]);
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCart(broken).items).toEqual([]);
    expect(() => saveCart(empty, broken)).not.toThrow();
  });
});
