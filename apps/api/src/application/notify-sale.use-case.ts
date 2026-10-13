import type { Order } from '../domain/order/order.js';
import type {
  NotificationChannel,
  NotificationLogRepository,
  NotificationSettingsRepository,
  SaleNotification,
} from '../domain/ports/index.js';

export function formatSaleMessage(order: Order, baseUrl: string): SaleNotification {
  const lines = order.items.map(
    (i) => `${i.quantity}x ${i.productName} — ${i.unitPrice.times(i.quantity).format()}`,
  );
  const a = order.address;
  const street = [a.street, a.number, a.complement].filter(Boolean).join(', ');
  return {
    text: [
      `Nova venda! Pedido #${order.publicCode}`,
      ...lines,
      `Frete: ${order.shipping.format()} | Total: ${order.total.format()}`,
      `Entregar para: ${order.customer.name} — ${order.customer.phone}`,
      `${street} — ${a.district}, ${a.city}/${a.state} — CEP ${a.cep.formatted}`,
      `Ver no painel: ${baseUrl}/painel/vendas/${order.publicCode}`,
    ].join('\n'),
  };
}

export class NotifySaleUseCase {
  constructor(
    private readonly channels: NotificationChannel[],
    private readonly settings: NotificationSettingsRepository,
    private readonly log: NotificationLogRepository,
    private readonly baseUrl: string,
  ) {}

  async execute(order: Order): Promise<void> {
    const message = formatSaleMessage(order, this.baseUrl);
    const enabled = await this.settings.enabledChannels();
    const targets = this.channels.filter((c) => enabled.includes(c.name));
    const results = await Promise.allSettled(targets.map((c) => c.send(message)));
    await this.log.record(
      order.id,
      targets.map((c) => c.name),
      results,
    );
    if (targets.length > 0 && results.every((r) => r.status === 'rejected')) {
      throw new Error('Falha em todos os canais de aviso');
    }
  }
}
