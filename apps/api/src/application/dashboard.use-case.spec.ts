import { describe, expect, it } from 'vitest';
import type { DashboardQuery, DashboardRaw } from '../domain/ports/index.js';
import { GetDashboardUseCase, resolvePeriod } from './dashboard.use-case.js';

// 2026-03-18 14:00 in São Paulo (UTC-3) = 17:00 UTC
const now = new Date('2026-03-18T17:00:00Z');

describe('resolvePeriod', () => {
  it('"hoje" covers only today in São Paulo time', () => {
    const p = resolvePeriod('hoje', now);
    expect(p.days).toEqual(['2026-03-18']);
    expect(p.from.toISOString()).toBe('2026-03-18T03:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-03-19T03:00:00.000Z');
  });

  it('uses the São Paulo calendar day even when UTC is already tomorrow', () => {
    const lateNight = new Date('2026-03-19T01:30:00Z'); // 22:30 on the 18th in São Paulo
    expect(resolvePeriod('hoje', lateNight).days).toEqual(['2026-03-18']);
  });

  it('"7dias" is today and the six days before', () => {
    const p = resolvePeriod('7dias', now);
    expect(p.days).toHaveLength(7);
    expect(p.days[0]).toBe('2026-03-12');
    expect(p.days.at(-1)).toBe('2026-03-18');
  });

  it('"mes" runs from the first of the month through today, across month lengths', () => {
    expect(resolvePeriod('mes', now).days).toHaveLength(18);
    expect(resolvePeriod('mes', now).days[0]).toBe('2026-03-01');
    const leapFeb = resolvePeriod('7dias', new Date('2028-03-02T12:00:00Z'));
    expect(leapFeb.days).toContain('2028-02-29');
  });
});

describe('resolvePeriod (custom range)', () => {
  it('covers exactly the chosen days, in São Paulo time', () => {
    const p = resolvePeriod('personalizado', now, { from: '2026-02-27', to: '2026-03-02' });
    expect(p.days).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(p.from.toISOString()).toBe('2026-02-27T03:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-03-03T03:00:00.000Z');
  });

  it('requires a range', () => {
    expect(() => resolvePeriod('personalizado', now)).toThrow(/intervalo/i);
  });
});

const raw = (overrides: Partial<DashboardRaw> = {}): DashboardRaw => ({
  byDay: [],
  topProducts: [],
  topIngredients: [],
  lowStock: [],
  ...overrides,
});

const queryReturning = (data: DashboardRaw) => {
  const calls: Array<{ from: Date; to: Date }> = [];
  const query: DashboardQuery = {
    async aggregate(from, to) {
      calls.push({ from, to });
      return data;
    },
  };
  return { query, calls };
};

describe('GetDashboardUseCase', () => {
  it('sums revenue and sales, computes the average ticket and fills empty days', async () => {
    const { query, calls } = queryReturning(
      raw({
        byDay: [
          { day: '2026-03-12', salesCount: 2, revenueCents: 9000 },
          { day: '2026-03-18', salesCount: 1, revenueCents: 4600 },
        ],
        topProducts: [{ name: 'Lavanda', quantity: 5, revenueCents: 9000 }],
        topIngredients: [{ name: 'Karité', quantity: 7 }],
        lowStock: [{ id: 'p1', name: 'Argila', stock: 1 }],
      }),
    );
    const result = await new GetDashboardUseCase(query, () => now).execute('7dias');

    expect(result).toMatchObject({
      period: '7dias',
      from: '2026-03-12',
      to: '2026-03-18',
      revenueCents: 13600,
      salesCount: 3,
      averageTicketCents: 4533,
    });
    expect(result.salesByDay).toHaveLength(7);
    expect(result.salesByDay[1]).toEqual({ day: '2026-03-13', salesCount: 0, revenueCents: 0 });
    expect(result.topProducts[0]?.name).toBe('Lavanda');
    expect(result.lowStock).toHaveLength(1);
    expect(calls[0]?.from.toISOString()).toBe('2026-03-12T03:00:00.000Z');
  });

  it('answers a custom range with its own first and last day', async () => {
    const { query, calls } = queryReturning(
      raw({ byDay: [{ day: '2026-03-02', salesCount: 1, revenueCents: 5000 }] }),
    );
    const result = await new GetDashboardUseCase(query, () => now).execute('personalizado', {
      from: '2026-03-01',
      to: '2026-03-03',
    });
    expect(result).toMatchObject({
      period: 'personalizado',
      from: '2026-03-01',
      to: '2026-03-03',
      salesCount: 1,
      revenueCents: 5000,
    });
    expect(result.salesByDay).toHaveLength(3);
    expect(calls[0]?.to.toISOString()).toBe('2026-03-04T03:00:00.000Z');
  });

  it('returns zeros, not NaN, when there were no sales', async () => {
    const { query } = queryReturning(raw());
    const result = await new GetDashboardUseCase(query, () => now).execute('hoje');
    expect(result).toMatchObject({ revenueCents: 0, salesCount: 0, averageTicketCents: 0 });
    expect(result.salesByDay).toEqual([{ day: '2026-03-18', salesCount: 0, revenueCents: 0 }]);
  });

  it('ignores aggregated days outside the period', async () => {
    const { query } = queryReturning(
      raw({ byDay: [{ day: '2025-01-01', salesCount: 9, revenueCents: 99999 }] }),
    );
    const result = await new GetDashboardUseCase(query, () => now).execute('hoje');
    expect(result.salesCount).toBe(0);
  });
});
