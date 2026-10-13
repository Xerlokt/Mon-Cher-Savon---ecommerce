export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity?: number }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; state: CartState };

export const MAX_QUANTITY = 20;
export const CART_STORAGE_KEY = 'mon-cher-savon:cart:v1';

const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(0, Math.floor(n)));

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const quantity = action.quantity ?? 1;
      const existing = state.items.find((i) => i.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === existing.productId
              ? { ...i, quantity: clamp(i.quantity + quantity) }
              : i,
          ),
        };
      }
      return { items: [...state.items, { ...action.item, quantity: clamp(quantity) }] };
    }
    case 'setQuantity': {
      const quantity = clamp(action.quantity);
      if (quantity === 0) {
        return { items: state.items.filter((i) => i.productId !== action.productId) };
      }
      return {
        items: state.items.map((i) => (i.productId === action.productId ? { ...i, quantity } : i)),
      };
    }
    case 'remove':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'clear':
      return { items: [] };
    case 'hydrate':
      return action.state;
  }
}

export const cartCount = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);

export const cartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isItem = (v: unknown): v is CartItem => {
  if (typeof v !== 'object' || v === null) return false;
  const i = v as Record<string, unknown>;
  return (
    typeof i['productId'] === 'string' &&
    typeof i['slug'] === 'string' &&
    typeof i['name'] === 'string' &&
    typeof i['priceCents'] === 'number' &&
    typeof i['quantity'] === 'number' &&
    i['quantity'] >= 1 &&
    (i['imageUrl'] === null || typeof i['imageUrl'] === 'string')
  );
};

export function loadCart(storage: StorageLike): CartState {
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(parsed.items) || !parsed.items.every(isItem)) return { items: [] };
    return { items: parsed.items.map((i) => ({ ...i, quantity: clamp(i.quantity) })) };
  } catch {
    return { items: [] };
  }
}

export function saveCart(state: CartState, storage: StorageLike): void {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked (private mode); the cart simply stays in memory.
  }
}
