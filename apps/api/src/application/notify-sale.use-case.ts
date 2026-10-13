import type { Order } from '../domain/order/order.js';
import type {
  NotificationChannel,
  NotificationLogRepository,
  NotificationSettingsRepository,
  SaleNotification,
} from '../domain/ports/index.js';

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

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
      `Entregar para: ${order.customer.name} — ${formatPhone(order.customer.phone)}`,
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
    const enabled = await this.settings.enabledTargets();
    const targets = enabled.flatMap(({ channel, destination }) => {
      const impl = this.channels.find((c) => c.name === channel);
      return impl ? [{ impl, destination }] : [];
    });
    const results = await Promise.allSettled(
      targets.map((t) => t.impl.send(message, t.destination)),
    );
    await this.log.record(
      order.id,
      targets.map((t) => t.impl.name),
      results,
    );
    if (targets.length > 0 && results.every((r) => r.status === 'rejected')) {
      throw new Error('Falha em todos os canais de aviso');
    }
  }
}
