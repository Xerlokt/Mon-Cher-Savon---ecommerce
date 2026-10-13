export interface OrderPaid {
  readonly type: 'OrderPaid';
  readonly orderId: string;
  readonly publicCode: string;
  readonly occurredAt: Date;
}
