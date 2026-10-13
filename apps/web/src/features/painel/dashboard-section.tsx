'use client';

import type { DashboardMetrics, DashboardPeriod } from '@mon-cher-savon/contracts';
import { useState } from 'react';
import { formatPrice } from '@/shared/format';
import { adminRequest, friendlyError } from './admin-request';
import { BarList } from './bar-list';
import { formatDayLabel } from './labels';
import { PanelCard } from './ui';

const PERIODS: Array<{ key: DashboardPeriod; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7dias', label: '7 dias' },
  { key: 'mes', label: 'Este mês' },
];

const PERIOD_TEXT: Record<DashboardPeriod, string> = {
  hoje: 'hoje',
  '7dias': 'nos últimos 7 dias',
  mes: 'neste mês',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Quanto vendi?" with a period switch, plus the simple charts below it. */
export function DashboardSection({ initial }: { initial: DashboardMetrics }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(period: DashboardPeriod) {
    if (period === data.period || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminRequest<DashboardMetrics>('GET', `/admin/dashboard?period=${period}`));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PanelCard
        id="vendi"
        title="Quanto vendi?"
        help="É o dinheiro das vendas já pagas, com o frete. Vendas canceladas não entram."
      >
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={data.period === p.key}
              onClick={() => void choose(p.key)}
              className={`min-h-12 rounded-full border px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 ${
                data.period === p.key
                  ? 'border-sage-700 bg-sage-700 text-cream-50'
                  : 'border-sage-400 bg-white text-sage-700 hover:bg-clay-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <div aria-busy={loading} aria-live="polite" className={loading ? 'opacity-60' : undefined}>
          <p className="text-base text-ink-900/70">Você vendeu {PERIOD_TEXT[data.period]}</p>
          <p className="font-heading text-5xl font-bold text-sage-700">
            {formatPrice(data.revenueCents)}
          </p>
          <p className="mt-1">
            {data.salesCount === 0
              ? 'Ainda não teve vendas neste período.'
              : `${plural(data.salesCount, 'venda', 'vendas')} · valor médio de ${formatPrice(
                  data.averageTicketCents,
                )} por venda`}
          </p>
        </div>
      </PanelCard>

      {data.period !== 'hoje' ? (
        <PanelCard
          id="por-dia"
          title="Vendas por dia"
          help="Cada barra é um dia. O número ao lado diz quanto você vendeu e quantas vendas foram."
        >
          <BarList
            ariaLabel="Vendas por dia"
            emptyText="Ainda não teve vendas neste período."
            items={data.salesByDay.map((d) => ({
              label: formatDayLabel(d.day),
              value: d.revenueCents,
              valueLabel:
                d.salesCount === 0
                  ? '—'
                  : `${formatPrice(d.revenueCents)} · ${plural(d.salesCount, 'venda', 'vendas')}`,
            }))}
          />
        </PanelCard>
      ) : null}

      <PanelCard
        id="mais-vendidos"
        title="Sabonetes mais vendidos"
        help="Os 5 sabonetes que mais saíram neste período."
      >
        <BarList
          ariaLabel="Sabonetes mais vendidos"
          emptyText="Quando você vender, os campeões aparecem aqui."
          items={data.topProducts.map((p) => ({
            label: p.name,
            value: p.quantity,
            valueLabel: plural(p.quantity, 'vendido', 'vendidos'),
          }))}
        />
      </PanelCard>

      <PanelCard
        id="ingredientes"
        title="Ingredientes mais comprados"
        help="Soma dos ingredientes dos sabonetes vendidos. Ajuda a saber o que comprar para produzir."
      >
        <BarList
          ariaLabel="Ingredientes mais comprados"
          emptyText="Quando você vender, os ingredientes mais usados aparecem aqui."
          items={data.topIngredients.map((i) => ({
            label: i.name,
            value: i.quantity,
            valueLabel: plural(i.quantity, 'sabonete', 'sabonetes'),
          }))}
        />
      </PanelCard>
    </>
  );
}
