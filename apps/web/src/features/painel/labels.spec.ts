import { describe, expect, it } from 'vitest';
import { SALES_FILTERS, STATUS_LABEL, formatCep, formatDateTime, formatPhone } from './labels';

describe('labels', () => {
  it('uses everyday words and covers every status', () => {
    expect(Object.keys(STATUS_LABEL)).toHaveLength(6);
    expect(STATUS_LABEL.REFUNDED).toBe('Dinheiro devolvido');
    expect(STATUS_LABEL.PAID).toBe('Pago — falta enviar');
    expect(SALES_FILTERS[0]).toMatchObject({ key: 'enviar', status: 'PAID' });
    expect(SALES_FILTERS.at(-1)?.status).toBeUndefined();
  });

  it('formats phone and CEP and leaves unknown shapes alone', () => {
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('+1 555')).toBe('+1 555');
    expect(formatCep('01310100')).toBe('01310-100');
    expect(formatCep('123')).toBe('123');
  });

  it('formats dates in Brazil time', () => {
    expect(formatDateTime('2026-01-02T15:30:00.000Z').replace(/\s/g, ' ')).toMatch(/02\/01.*12:30/);
  });
});

describe('formatDayLabel', () => {
  it('shows the weekday and day/month', async () => {
    const { formatDayLabel } = await import('./labels');
    expect(formatDayLabel('2026-03-18')).toBe('qua 18/03');
    expect(formatDayLabel('2026-01-04')).toBe('dom 04/01');
    expect(formatDayLabel('lixo')).toBe('lixo');
  });
});
