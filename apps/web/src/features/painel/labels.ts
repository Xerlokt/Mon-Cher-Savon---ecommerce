export type OrderStatus =
  'AWAITING_PAYMENT' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

/** Everyday words for the seller (never "order", "pending" or "fulfilled"). */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago — falta enviar',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Dinheiro devolvido',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'bg-warning/15 text-warning',
  PAID: 'bg-success/15 text-success',
  SHIPPED: 'bg-sage-400/30 text-sage-700',
  DELIVERED: 'bg-sage-400/30 text-sage-700',
  CANCELLED: 'bg-danger/10 text-danger',
  REFUNDED: 'bg-danger/10 text-danger',
};

export const SALES_FILTERS: Array<{ key: string; label: string; status?: OrderStatus }> = [
  { key: 'enviar', label: 'Para enviar', status: 'PAID' },
  { key: 'enviadas', label: 'Enviadas', status: 'SHIPPED' },
  { key: 'entregues', label: 'Entregues', status: 'DELIVERED' },
  { key: 'aguardando', label: 'Aguardando pagamento', status: 'AWAITING_PAYMENT' },
  { key: 'canceladas', label: 'Canceladas', status: 'CANCELLED' },
  { key: 'reembolsadas', label: 'Dinheiro devolvido', status: 'REFUNDED' },
  { key: 'todas', label: 'Todas' },
];

/** "11912345678" -> "(11) 91234-5678". */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : raw;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "2026-03-18" -> "qua 18/03" (the date is a calendar day, so no time zone math). */
export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  return `${weekday} ${String(date).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}
