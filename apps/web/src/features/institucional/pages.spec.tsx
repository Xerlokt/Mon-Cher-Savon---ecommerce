import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import AboutPage from '@/app/(loja)/sobre/page';
import PrivacyPage from '@/app/(loja)/politicas/privacidade/page';
import ReturnsPage from '@/app/(loja)/politicas/trocas/page';

describe('institutional pages', () => {
  it('the privacy policy covers data, purpose, sharing, rights and says card data is not stored', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de privacidade' }),
    ).toBeInTheDocument();
    for (const heading of [
      'Quais dados coletamos',
      'Para que usamos',
      'Com quem compartilhamos',
      'Os seus direitos',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(/Não guardamos dados de cartão/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /@/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:/),
    );
  });

  it('the returns policy states the 7-day right of withdrawal', () => {
    render(<ReturnsPage />);
    expect(screen.getByText(/7 dias/, { selector: 'strong' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Produto com defeito ou erro no pedido' }),
    ).toBeInTheDocument();
  });

  it('the about page links to the catalog', () => {
    render(<AboutPage />);
    expect(screen.getByRole('link', { name: 'sabonetes disponíveis' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
  });

  it.each([
    ['privacy', <PrivacyPage key="p" />],
    ['returns', <ReturnsPage key="r" />],
    ['about', <AboutPage key="a" />],
  ])('%s page has no accessibility violations', async (_name, page) => {
    const { container } = render(page);
    expect(await axe(container)).toHaveNoViolations();
  });
});
