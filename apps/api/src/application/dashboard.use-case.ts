import type { DashboardMetrics, DashboardPeriod } from '@mon-cher-savon/contracts';
import type { DashboardQuery } from '../domain/ports/index.js';

/** Brazil has no daylight saving time since 2019, so São Paulo is a fixed UTC-3. */
const SAO_PAULO_OFFSET_HOURS = -3;
const DAY_MS = 24 * 3600 * 1000;

export interface ResolvedPeriod {
  /** Inclusive start (instant). */
  from: Date;
  /** Exclusive end (instant): start of the day after the last day. */
  to: Date;
  /** Every calendar day (YYYY-MM-DD, São Paulo) in the period. */
  days: string[];
}

const dayKey = (utcMidnightMs: number): string =>
  new Date(utcMidnightMs).toISOString().slice(0, 10);

/** Start of the São Paulo calendar day containing `now`, as a UTC-midnight stamp of that date. */
function todayDateStamp(now: Date): number {
  const local = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * 3600 * 1000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

export function resolvePeriod(period: DashboardPeriod, now: Date): ResolvedPeriod {
  const today = todayDateStamp(now);
  let first = today;
  if (period === '7dias') first = today - 6 * DAY_MS;
  if (period === 'mes') {
    const d = new Date(today);
    first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  const days: string[] = [];
  for (let t = first; t <= today; t += DAY_MS) days.push(dayKey(t));
  // Local midnight = UTC midnight shifted by the offset (UTC-3 -> 03:00Z).
  const toInstant = (dateStamp: number) =>
    new Date(dateStamp - SAO_PAULO_OFFSET_HOURS * 3600 * 1000);
  return { from: toInstant(first), to: toInstant(today + DAY_MS), days };
}

export class GetDashboardUseCase {
  constructor(
    private readonly query: DashboardQuery,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(period: DashboardPeriod): Promise<DashboardMetrics> {
    const resolved = resolvePeriod(period, this.now());
    const raw = await this.query.aggregate(resolved.from, resolved.to);

    const byDay = new Map(raw.byDay.map((d) => [d.day, d]));
    const salesByDay = resolved.days.map((day) => ({
      day,
      salesCount: byDay.get(day)?.salesCount ?? 0,
      revenueCents: byDay.get(day)?.revenueCents ?? 0,
    }));
    const salesCount = salesByDay.reduce((sum, d) => sum + d.salesCount, 0);
    const revenueCents = salesByDay.reduce((sum, d) => sum + d.revenueCents, 0);

    return {
      period,
      from: resolved.days[0] ?? '',
      to: resolved.days.at(-1) ?? '',
      revenueCents,
      salesCount,
      averageTicketCents: salesCount === 0 ? 0 : Math.round(revenueCents / salesCount),
      salesByDay,
      topProducts: raw.topProducts,
      topIngredients: raw.topIngredients,
      lowStock: raw.lowStock,
    };
  }
}
