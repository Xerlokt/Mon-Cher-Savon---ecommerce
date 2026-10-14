'use client';

import {
  createOrderSchema,
  type CreateOrderRequest,
  type CreateOrderResponse,
} from '@mon-cher-savon/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/features/carrinho/cart-provider';
import { formatPrice } from '@/shared/format';
import { createOrder as defaultCreateOrder, type ShippingOption } from './api';
import {
  CARD_FIELD_IDS,
  createMercadoPagoTokenizer,
  type CardTokenizer,
  type CardTokenizerFactory,
} from './card-tokenizer';
import { lookupCep as defaultLookup, type CepAddress } from './viacep';

export const pixStorageKey = (code: string) => `mon-cher-savon:pix:${code}`;

interface Props {
  shippingOptions: ShippingOption[];
  createOrder?: (payload: CreateOrderRequest) => Promise<CreateOrderResponse>;
  lookup?: (cep: string) => Promise<CepAddress | null>;
  /** MercadoPago public key (safe to expose). Without it the store accepts Pix only. */
  cardPublicKey?: string | undefined;
  createTokenizer?: CardTokenizerFactory;
}

/** Brazilian CPF check digits (an invalid number would only fail later, at the bank). */
export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

const input =
  'mt-1 block min-h-12 w-full rounded-lg border border-sage-400 bg-white px-3 text-base text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-700 aria-[invalid=true]:border-danger';

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-semibold text-sage-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({
  shippingOptions,
  createOrder = defaultCreateOrder,
  lookup = defaultLookup,
  cardPublicKey,
  createTokenizer = createMercadoPagoTokenizer,
}: Props) {
  const router = useRouter();
  const { items, subtotalCents, dispatch, hydrated } = useCart();
  const [values, setValues] = useState({
    name: '',
    phone: '',
    email: '',
    cep: '',
    street: '',
    number: '',
    district: '',
    city: '',
    state: '',
    complement: '',
  });
  const [shipping, setShipping] = useState<ShippingOption['code']>(
    shippingOptions[0]?.code ?? 'LOCAL',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');
  const [holder, setHolder] = useState({ name: '', cpf: '' });
  const tokenizer = useRef<CardTokenizer | null>(null);

  // The secure fields live only while "Cartão" is chosen.
  useEffect(() => {
    if (method !== 'CARD' || !cardPublicKey) return;
    const instance = createTokenizer(cardPublicKey);
    tokenizer.current = instance;
    instance.mount().catch((error: unknown) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o pagamento por cartão.',
      );
    });
    return () => {
      instance.unmount();
      tokenizer.current = null;
    };
  }, [method, cardPublicKey, createTokenizer]);

  const shippingCents = shippingOptions.find((o) => o.code === shipping)?.priceCents ?? 0;
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cep = e.target.value;
    setValues((v) => ({ ...v, cep }));
    if (cep.replace(/\D/g, '').length !== 8) {
      setCepStatus('idle');
      return;
    }
    setCepStatus('loading');
    const address = await lookup(cep);
    if (!address) {
      setCepStatus('notfound');
      return;
    }
    setCepStatus('idle');
    setValues((v) => ({ ...v, ...address }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    let card: { cardToken: string; cardPaymentMethodId: string } | null = null;
    if (method === 'CARD') {
      const cardErrors: Record<string, string> = {};
      if (holder.name.trim().length < 3)
        cardErrors['cardholderName'] = 'Informe o nome como está no cartão';
      if (!isValidCpf(holder.cpf)) cardErrors['cpf'] = 'CPF inválido';
      if (Object.keys(cardErrors).length > 0) {
        setErrors(cardErrors);
        setFormError('Confira os campos destacados e tente de novo.');
        return;
      }
    }

    const parsed = createOrderSchema.safeParse({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customer: { name: values.name, phone: values.phone, email: values.email },
      address: {
        cep: values.cep,
        street: values.street,
        number: values.number,
        district: values.district,
        city: values.city,
        state: values.state,
        ...(values.complement ? { complement: values.complement } : {}),
      },
      shippingOption: shipping,
      paymentMethod: method,
      ...(method === 'CARD' ? { cardToken: 'pending', cardPaymentMethodId: 'pending' } : {}),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[issue.path.length - 1];
        if (typeof key === 'string' && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError('Confira os campos destacados e tente de novo.');
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (method === 'CARD') {
        const active = tokenizer.current;
        if (!active)
          throw new Error('O pagamento por cartão ainda está carregando. Tente de novo.');
        const { token, paymentMethodId } = await active.tokenize({
          name: holder.name.trim(),
          cpf: holder.cpf.replace(/\D/g, ''),
        });
        card = { cardToken: token, cardPaymentMethodId: paymentMethodId };
      }
      const result = await createOrder(card ? { ...parsed.data, ...card } : parsed.data);
      try {
        if (method === 'PIX') {
          window.sessionStorage.setItem(
            pixStorageKey(result.publicCode),
            JSON.stringify(result.payment),
          );
        }
      } catch {
        // The order page still works without the cached Pix data.
      }
      dispatch({ type: 'clear' });
      router.push(`/pedido/${result.publicCode}`);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível finalizar o pedido. Tente de novo.',
      );
      setSubmitting(false);
    }
  }

  // The cart lives in the browser, so until it is read the page keeps the room the final content
  // needs (avoids the footer jumping, which Lighthouse counts as layout shift).
  if (!hydrated) return <div aria-busy="true" className="min-h-[70vh]" />;

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh]">
        <p>Seu carrinho está vazio.</p>
        <Link
          href="/catalogo"
          className="mt-3 inline-flex min-h-11 items-center text-terracotta-600 underline"
        >
          Escolher sabonetes
        </Link>
      </div>
    );
  }

  const fieldProps = (id: keyof typeof values) => ({
    id,
    name: id,
    value: values[id],
    onChange: set(id),
    'aria-invalid': errors[id] ? (true as const) : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
    className: input,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        {formError ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">
            {formError}
          </p>
        ) : null}

        <fieldset className="space-y-4">
          <legend className="font-heading text-2xl text-sage-700">Seus dados</legend>
          <Field id="name" label="Nome completo" error={errors['name']}>
            <input {...fieldProps('name')} autoComplete="name" />
          </Field>
          <Field id="phone" label="WhatsApp" error={errors['phone']}>
            <input
              {...fieldProps('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 91234-5678"
            />
          </Field>
          <Field id="email" label="E-mail" error={errors['email']}>
            <input {...fieldProps('email')} type="email" autoComplete="email" />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading text-2xl text-sage-700">Endereço de entrega</legend>
          <Field id="cep" label="CEP" error={errors['cep']}>
            <input
              {...fieldProps('cep')}
              onChange={onCepChange}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
            />
            {cepStatus === 'loading' ? <p className="mt-1 text-sm">Buscando endereço…</p> : null}
            {cepStatus === 'notfound' ? (
              <p role="status" className="mt-1 text-sm text-warning">
                Não encontramos esse CEP. Preencha o endereço manualmente.
              </p>
            ) : null}
          </Field>
          <Field id="street" label="Rua" error={errors['street']}>
            <input {...fieldProps('street')} autoComplete="address-line1" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="number" label="Número" error={errors['number']}>
              <input {...fieldProps('number')} />
            </Field>
            <Field id="complement" label="Complemento" error={errors['complement']}>
              <input {...fieldProps('complement')} autoComplete="address-line2" />
            </Field>
          </div>
          <Field id="district" label="Bairro" error={errors['district']}>
            <input {...fieldProps('district')} />
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <Field id="city" label="Cidade" error={errors['city']}>
              <input {...fieldProps('city')} autoComplete="address-level2" />
            </Field>
            <Field id="state" label="UF" error={errors['state']}>
              <input {...fieldProps('state')} maxLength={2} autoComplete="address-level1" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-heading text-2xl text-sage-700">Entrega</legend>
          {shippingOptions.map((option) => (
            <label
              key={option.code}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-sage-400 bg-white px-4"
            >
              <input
                type="radio"
                name="shipping"
                value={option.code}
                checked={shipping === option.code}
                onChange={() => setShipping(option.code)}
                className="h-5 w-5 accent-sage-700"
              />
              <span className="flex-1">{option.label}</span>
              <strong>{option.priceCents === 0 ? 'Grátis' : formatPrice(option.priceCents)}</strong>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-heading text-2xl text-sage-700">Pagamento</legend>
          {cardPublicKey ? (
            <>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-sage-400 bg-white px-4">
                <input
                  type="radio"
                  name="payment"
                  value="PIX"
                  checked={method === 'PIX'}
                  onChange={() => setMethod('PIX')}
                  className="h-5 w-5 accent-sage-700"
                />
                <span>
                  <strong>Pix</strong> — confirmado automaticamente
                </span>
              </label>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-sage-400 bg-white px-4">
                <input
                  type="radio"
                  name="payment"
                  value="CARD"
                  checked={method === 'CARD'}
                  onChange={() => setMethod('CARD')}
                  className="h-5 w-5 accent-sage-700"
                />
                <span>
                  <strong>Cartão de crédito</strong> — em 1x
                </span>
              </label>
            </>
          ) : (
            <p className="rounded-lg border border-sage-400 bg-white p-4">
              <strong>Pix</strong> — o QR Code aparece na próxima tela e o pedido é confirmado
              automaticamente.
            </p>
          )}

          {method === 'CARD' && cardPublicKey ? (
            <div className="space-y-4 rounded-lg border border-sage-400 bg-white p-4">
              <Field
                id="cardholderName"
                label="Nome impresso no cartão"
                error={errors['cardholderName']}
              >
                <input
                  id="cardholderName"
                  name="cardholderName"
                  value={holder.name}
                  onChange={(e) => setHolder((h) => ({ ...h, name: e.target.value }))}
                  autoComplete="cc-name"
                  aria-invalid={errors['cardholderName'] ? true : undefined}
                  aria-describedby={errors['cardholderName'] ? 'cardholderName-error' : undefined}
                  className={input}
                />
              </Field>
              <Field id="cpf" label="CPF do titular" error={errors['cpf']}>
                <input
                  id="cpf"
                  name="cpf"
                  value={holder.cpf}
                  onChange={(e) => setHolder((h) => ({ ...h, cpf: e.target.value }))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  aria-invalid={errors['cpf'] ? true : undefined}
                  aria-describedby={errors['cpf'] ? 'cpf-error' : undefined}
                  className={input}
                />
              </Field>
              <div>
                <p className="font-semibold text-sage-700" id="card-number-label">
                  Número do cartão
                </p>
                <div
                  id={CARD_FIELD_IDS.number}
                  aria-labelledby="card-number-label"
                  className="mt-1 min-h-12 rounded-lg border border-sage-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-sage-700" id="card-expiry-label">
                    Validade
                  </p>
                  <div
                    id={CARD_FIELD_IDS.expiry}
                    aria-labelledby="card-expiry-label"
                    className="mt-1 min-h-12 rounded-lg border border-sage-400"
                  />
                </div>
                <div>
                  <p className="font-semibold text-sage-700" id="card-cvv-label">
                    Código de segurança
                  </p>
                  <div
                    id={CARD_FIELD_IDS.cvv}
                    aria-labelledby="card-cvv-label"
                    className="mt-1 min-h-12 rounded-lg border border-sage-400"
                  />
                </div>
              </div>
              <p className="text-sm">
                Os dados do cartão são digitados em campos seguros do Mercado Pago. A loja nunca vê
                o número do seu cartão.
              </p>
            </div>
          ) : null}
        </fieldset>
      </div>

      <aside
        className="h-fit space-y-3 rounded-card bg-clay-100 p-5 shadow-soft"
        aria-label="Resumo do pedido"
      >
        <h2 className="font-heading text-xl text-sage-700">Resumo</h2>
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span>
                {i.quantity}x {i.name}
              </span>
              <span>{formatPrice(i.priceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between">
          <span>Frete</span>
          <span>{shippingCents === 0 ? 'Grátis' : formatPrice(shippingCents)}</span>
        </p>
        <p className="flex justify-between text-xl">
          <strong>Total</strong>
          <strong data-testid="total">{formatPrice(subtotalCents + shippingCents)}</strong>
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-terracotta-600 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:opacity-60"
        >
          {method === 'CARD'
            ? submitting
              ? 'Pagando…'
              : 'Pagar com cartão'
            : submitting
              ? 'Gerando o Pix…'
              : 'Pagar com Pix'}
        </button>
      </aside>
    </form>
  );
}
