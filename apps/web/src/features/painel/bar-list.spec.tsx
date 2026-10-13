import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { BarList } from './bar-list';

describe('BarList', () => {
  it('writes the number next to every bar and scales bars to the largest value', () => {
    render(
      <BarList
        ariaLabel="Mais vendidos"
        emptyText="Sem vendas"
        items={[
          { label: 'Lavanda', value: 10, valueLabel: '10 vendidos' },
          { label: 'Argila', value: 5, valueLabel: '5 vendidos' },
          { label: 'Mel', value: 0, valueLabel: '0 vendidos' },
        ]}
      />,
    );
    expect(screen.getByText('10 vendidos')).toBeInTheDocument();
    expect(screen.getByText('0 vendidos')).toBeInTheDocument();
    const widths = screen.getAllByTestId('bar').map((el) => el.style.width);
    expect(widths).toEqual(['100%', '50%', '0%']);
    expect(screen.getByRole('list', { name: 'Mais vendidos' })).toBeInTheDocument();
  });

  it('keeps tiny values visible', () => {
    render(
      <BarList
        ariaLabel="x"
        emptyText="-"
        items={[
          { label: 'A', value: 1000, valueLabel: '1000' },
          { label: 'B', value: 1, valueLabel: '1' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('bar')[1]?.style.width).toBe('2%');
  });

  it('shows a plain sentence when there is nothing to show', () => {
    const { rerender } = render(<BarList ariaLabel="x" emptyText="Ainda sem vendas." items={[]} />);
    expect(screen.getByText('Ainda sem vendas.')).toBeInTheDocument();
    rerender(
      <BarList
        ariaLabel="x"
        emptyText="Ainda sem vendas."
        items={[{ label: 'A', value: 0, valueLabel: '0' }]}
      />,
    );
    expect(screen.getByText('Ainda sem vendas.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <BarList ariaLabel="x" emptyText="-" items={[{ label: 'A', value: 2, valueLabel: '2' }]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
