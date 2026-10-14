import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DashboardMetrics } from '@mon-cher-savon/contracts';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardSection } from './dashboard-section';

const base: DashboardMetrics = {
  period: 'hoje',
  from: '2026-03-18',
  to: '2026-03-18',
  revenueCents: 7800,
  salesCount: 2,
  averageTicketCents: 3900,
  salesByDay: [{ day: '2026-03-18', salesCount: 2, revenueCents: 7800 }],
  topProducts: [
    { name: 'Lavanda', quantity: 5, revenueCents: 9000 },
    { name: 'Argila', quantity: 2, revenueCents: 4400 },
  ],
  topIngredients: [{ name: 'Karité', quantity: 7 }],
  lowStock: [],
};

const week: DashboardMetrics = {
  ...base,
  period: '7dias',
  from: '2026-03-12',
  revenueCents: 15000,
  salesCount: 4,
  averageTicketCents: 3750,
  salesByDay: [
    { day: '2026-03-17', salesCount: 1, revenueCents: 4400 },
    { day: '2026-03-18', salesCount: 3, revenueCents: 10600 },
    { day: '2026-03-16', salesCount: 0, revenueCents: 0 },
  ],
};

afterEach(() => vi.unstubAllGlobals());

const text = (el: HTMLElement) => el.textContent?.replace(/\s/g, ' ') ?? '';

describe('DashboardSection', () => {
  it('shows the headline numbers in plain words', () => {
    render(<DashboardSection initial={base} />);
    expect(screen.getByText('Quanto vendi?')).toBeInTheDocument();
    expect(screen.getByText(/Você vendeu hoje/)).toBeInTheDocument();
    expect(text(screen.getByText(/R\$\s78,00$/))).toBe('R$ 78,00');
    expect(screen.getByText(/2 vendas · valor médio de R\$\s39,00 por venda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists the best sellers and ingredients with the numbers written out', () => {
    render(<DashboardSection initial={base} />);
    const products = screen.getByRole('list', { name: 'Sabonetes mais vendidos' });
    expect(within(products).getByText('5 vendidos')).toBeInTheDocument();
    expect(within(products).getByText('Lavanda')).toBeInTheDocument();
    const ingredients = screen.getByRole('list', { name: 'Ingredientes mais comprados' });
    expect(within(ingredients).getByText('7 sabonetes')).toBeInTheDocument();
  });

  it('does not show the per-day chart for "hoje"', () => {
    render(<DashboardSection initial={base} />);
    expect(screen.queryByText('Vendas por dia')).not.toBeInTheDocument();
  });

  it('switches period, fetches the new numbers and shows the daily bars', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => week });
    vi.stubGlobal('fetch', fetchMock);
    render(<DashboardSection initial={base} />);
    await userEvent.click(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() =>
      expect(screen.getByText(/Você vendeu nos últimos 7 dias/)).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/admin/dashboard?period=7dias');
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');

    const daily = screen.getByRole('list', { name: 'Vendas por dia' });
    expect(within(daily).getAllByRole('listitem')).toHaveLength(3);
    expect(text(daily)).toContain('3 vendas');
    expect(text(daily)).toContain('1 venda');
    expect(within(daily).getByText('—')).toBeInTheDocument();
  });

  it('keeps the old numbers and explains when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<DashboardSection initial={base} />);
    await userEvent.click(screen.getByRole('button', { name: 'Este mês' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira a internet');
    expect(screen.getByText(/Você vendeu hoje/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not refetch the period that is already selected', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DashboardSection initial={base} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is friendly when nothing was sold yet', () => {
    render(
      <DashboardSection
        initial={{
          ...base,
          revenueCents: 0,
          salesCount: 0,
          averageTicketCents: 0,
          salesByDay: [{ day: '2026-03-18', salesCount: 0, revenueCents: 0 }],
          topProducts: [],
          topIngredients: [],
        }}
      />,
    );
    expect(screen.getByText('Ainda não teve vendas neste período.')).toBeInTheDocument();
    expect(screen.getByText(/os campeões aparecem aqui/)).toBeInTheDocument();
  });

  it('lets the seller pick any dates and shows the daily bars', async () => {
    const custom = {
      ...week,
      period: 'personalizado' as const,
      from: '2026-03-01',
      to: '2026-03-18',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => custom });
    vi.stubGlobal('fetch', fetchMock);
    render(<DashboardSection initial={base} />);

    const open = screen.getByRole('button', { name: 'Escolher datas' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    await userEvent.type(screen.getByLabelText('De'), '2026-03-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-03-18');
    await userEvent.click(screen.getByRole('button', { name: 'Ver vendas' }));

    await waitFor(() =>
      expect(screen.getByText(/Você vendeu de 01\/03 a 18\/03/)).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/admin/dashboard?period=personalizado&from=2026-03-01&to=2026-03-18',
    );
    expect(screen.getByRole('button', { name: 'Escolher datas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('list', { name: 'Vendas por dia' })).toBeInTheDocument();
  });

  it('explains a wrong range without calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DashboardSection initial={base} />);
    await userEvent.click(screen.getByRole('button', { name: 'Escolher datas' }));

    await userEvent.click(screen.getByRole('button', { name: 'Ver vendas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha as duas datas');

    await userEvent.type(screen.getByLabelText('De'), '2026-03-18');
    await userEvent.type(screen.getByLabelText('Até'), '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: 'Ver vendas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('antes da data final');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DashboardSection initial={week} />);
    await userEvent.click(screen.getByRole('button', { name: 'Escolher datas' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
