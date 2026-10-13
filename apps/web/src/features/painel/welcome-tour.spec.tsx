import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOUR_STORAGE_KEY, WelcomeTour } from './welcome-tour';

beforeEach(() => window.localStorage.clear());

describe('WelcomeTour', () => {
  it('shows on the first visit, walks the four steps and never returns', async () => {
    render(<WelcomeTour />);
    expect(await screen.findByText('Bem-vinda ao seu painel!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Vendas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Passo 4 de 4')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
    await waitFor(() => expect(screen.queryByText('Passo 4 de 4')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done');

    render(<WelcomeTour />);
    expect(screen.queryByText('Bem-vinda ao seu painel!')).not.toBeInTheDocument();
  });

  it('can be skipped', async () => {
    render(<WelcomeTour />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pular' }));
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done');
  });

  it('does not appear again once it was seen', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    render(<WelcomeTour />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    render(<WelcomeTour />);
    await screen.findByRole('dialog');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
