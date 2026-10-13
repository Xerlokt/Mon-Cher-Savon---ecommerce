import { describe, expect, it } from 'vitest';
import { Money } from '../shared/money.js';
import { Product } from './product.js';

const make = (stock = 5) =>
  Product.create({
    id: 'p1',
    slug: 'lavanda',
    name: 'Sabonete de Lavanda',
    priceCents: 1800,
    stock,
    lowStockThreshold: 3,
  });

describe('Product', () => {
  it('is sold out with zero stock', () => expect(make(0).isSoldOut).toBe(true));
  it('flags low stock at or below threshold', () => {
    expect(make(3).isLowStock).toBe(true);
    expect(make(4).isLowStock).toBe(false);
  });
  it('decreases stock but never below zero', () => {
    const product = make(2);
    product.decreaseStock(2);
    expect(product.stock).toBe(0);
    expect(() => product.decreaseStock(1)).toThrow();
  });
  it('increases stock and rejects non-positive deltas', () => {
    const product = make(0);
    product.increaseStock(4);
    expect(product.stock).toBe(4);
    expect(() => product.increaseStock(0)).toThrow();
    expect(() => product.decreaseStock(0)).toThrow();
  });
  it('archives instead of deleting', () => {
    const product = make();
    product.archive();
    expect(product.status).toBe('ARCHIVED');
    expect(product.isPurchasable).toBe(false);
  });
  it('exposes price as Money', () => expect(make().price.equals(Money.cents(1800))).toBe(true));
  it('rejects empty name', () => {
    expect(() =>
      Product.create({
        id: 'x',
        slug: 'x',
        name: ' ',
        priceCents: 1,
        stock: 0,
        lowStockThreshold: 0,
      }),
    ).toThrow();
  });
});
