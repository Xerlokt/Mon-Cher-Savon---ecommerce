import { DomainError } from '../shared/domain-error.js';
import { Money } from '../shared/money.js';

export type ProductStatus = 'ACTIVE' | 'ARCHIVED';

export interface ProductProps {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  stock: number;
  lowStockThreshold: number;
  status?: ProductStatus;
}

export class Product {
  private constructor(
    readonly id: string,
    readonly slug: string,
    readonly name: string,
    readonly price: Money,
    private _stock: number,
    readonly lowStockThreshold: number,
    private _status: ProductStatus,
  ) {}

  static create(props: ProductProps): Product {
    if (props.name.trim() === '') throw new DomainError('Nome do sabonete é obrigatório');
    if (props.stock < 0) throw new DomainError('Estoque não pode ser negativo');
    return new Product(
      props.id,
      props.slug,
      props.name.trim(),
      Money.cents(props.priceCents),
      props.stock,
      props.lowStockThreshold,
      props.status ?? 'ACTIVE',
    );
  }

  get stock(): number {
    return this._stock;
  }
  get status(): ProductStatus {
    return this._status;
  }
  get isSoldOut(): boolean {
    return this._stock === 0;
  }
  get isLowStock(): boolean {
    return this._stock <= this.lowStockThreshold;
  }
  get isPurchasable(): boolean {
    return this._status === 'ACTIVE' && !this.isSoldOut;
  }

  decreaseStock(quantity: number): void {
    this.assertPositive(quantity);
    if (quantity > this._stock) throw new DomainError('Estoque insuficiente');
    this._stock -= quantity;
  }

  increaseStock(quantity: number): void {
    this.assertPositive(quantity);
    this._stock += quantity;
  }

  archive(): void {
    this._status = 'ARCHIVED';
  }

  private assertPositive(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError('Quantidade deve ser um inteiro positivo');
    }
  }
}
