import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUR_STORAGE_KEY } from './welcome-tour';
import { PainelShell, TABS, isActiveTab } from './painel-shell';

let pathname = '/painel';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/painel';
  window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
});

describe('isActiveTab', () => {
  it('matches Início exactly and the others by prefix', () => {
    const [home, sales] = TABS;
    expect(isActiveTab('/painel', home!)).toBe(true);
    expect(isActiveTab('/painel/vendas', home!)).toBe(false);
    expect(isActiveTab('/painel/vendas/A7K2', sales!)).toBe(true);
    expect(isActiveTab('/painel/vendasx', sales!)).toBe(false);
  });
});

describe('PainelShell', () => {
  it('always shows the four tabs with icon and text and marks the current one', () => {
    pathname = '/painel/sabonetes/novo';
    render(<PainelShell>conteúdo</PainelShell>);
    const names = TABS.map((t) => t.label);
    for (const name of names) expect(screen.getByRole('link', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meus sabonetes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Vendas' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PainelShell>conteúdo</PainelShell>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
