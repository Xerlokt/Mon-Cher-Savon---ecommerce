import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminProductView } from '@mon-cher-savon/contracts';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/shared/ui/toast';
import { ProductWizard } from './product-wizard';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const ingredients = [
  { id: 'i1', name: 'Argila verde', benefit: 'Pele oleosa' },
  { id: 'i2', name: 'Karité', benefit: 'Pele seca' },
];

const existing: AdminProductView = {
  id: 'p1',
  slug: 'lavanda',
  name: 'Lavanda',
  description: 'Feito à mão',
  usage: '',
  aroma: 'Floral',
  priceCents: 1850,
  weightGrams: 100,
  stock: 4,
  lowStockThreshold: 3,
  lowStock: false,
  status: 'ACTIVE',
  images: ['/uploads/a.png'],
  ingredientIds: ['i2'],
};

const renderWizard = (product?: AdminProductView) =>
  render(
    <ToastProvider>
      <ProductWizard ingredients={ingredients} {...(product ? { product } : {})} />
    </ToastProvider>,
  );

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

const next = () => userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('ProductWizard', () => {
  it('walks Fotos → Nome e preço → Ingredientes → Revisar', async () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: '1. Fotos' })).toBeInTheDocument();
    await next();
    expect(screen.getByRole('heading', { name: '2. Nome e preço' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex.: Sabonete de lavanda')).toBeInTheDocument();
  });

  it('will not leave step 2 without a name and a valid price', async () => {
    renderWizard();
    await next();
    await next();
    expect(screen.getByText(/Dê um nome ao sabonete/)).toBeInTheDocument();
    expect(screen.getByText(/Informe o preço/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do sabonete')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: '2. Nome e preço' })).toBeInTheDocument();
  });

  it('creates a product with price in cents, chosen ingredients and initial stock', async () => {
    const fetchMock = reply(201, { id: 'new' });
    vi.stubGlobal('fetch', fetchMock);
    renderWizard();
    await next();
    await userEvent.type(screen.getByLabelText('Nome do sabonete'), 'Sabonete de Mel');
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '17,50');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    await next();
    await userEvent.click(screen.getByLabelText(/Argila verde/));
    await next();
    expect(screen.getByText('Argila verde')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar sabonete' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/painel/sabonetes'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/products');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: 'Sabonete de Mel',
      priceCents: 1750,
      stock: 2,
      ingredientIds: ['i1'],
    });
  });

  it('edits an existing product, prefilled, without sending stock', async () => {
    const fetchMock = reply(200, existing);
    vi.stubGlobal('fetch', fetchMock);
    renderWizard(existing);
    await next();
    expect(screen.getByLabelText('Nome do sabonete')).toHaveValue('Lavanda');
    expect(screen.getByLabelText('Preço (R$)')).toHaveValue('18,50');
    expect(screen.getByText(/botões \+ e − na lista/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Preço (R$)'));
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '20');
    await next();
    expect(screen.getByLabelText(/Karité/)).toBeChecked();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar sabonete' }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/products/p1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(String(init.body));
    expect(body.priceCents).toBe(2000);
    expect(body).not.toHaveProperty('stock');
  });

  it('uploads photos and lets her remove them', async () => {
    const fetchMock = reply(201, { url: '/uploads/nova.png' });
    vi.stubGlobal('fetch', fetchMock);
    renderWizard();
    const file = new File([new Uint8Array(4)], 'foto.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Escolher fotos/), file);
    expect(await screen.findByRole('button', { name: 'Tirar esta foto' })).toBeInTheDocument();
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBeInstanceOf(FormData);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar esta foto' }));
    expect(screen.queryByRole('button', { name: 'Tirar esta foto' })).not.toBeInTheDocument();
  });

  it('adds a new ingredient and selects it', async () => {
    vi.stubGlobal('fetch', reply(201, { id: 'i3', name: 'Aveia', benefit: 'Pele sensível' }));
    renderWizard();
    await next();
    await userEvent.type(screen.getByLabelText('Nome do sabonete'), 'Aveia e mel');
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '19');
    await next();
    await userEvent.type(screen.getByLabelText('Nome'), 'Aveia');
    await userEvent.type(screen.getByLabelText('Para que serve'), 'Pele sensível');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar ingrediente' }));
    expect(await screen.findByLabelText(/Aveia/)).toBeChecked();
  });

  it('shows a friendly error and stays on the review step when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderWizard();
    await next();
    await userEvent.type(screen.getByLabelText('Nome do sabonete'), 'Sabonete de Mel');
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '17');
    await next();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar sabonete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira a internet');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar sabonete' })).toBeEnabled();
  });

  it('has no accessibility violations on the main step', async () => {
    const { container } = renderWizard();
    await next();
    expect(await axe(container)).toHaveNoViolations();
  });
});
