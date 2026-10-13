'use client';

import type { AdminProductView, ProductInput } from '@mon-cher-savon/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NumberStepper } from '@/shared/ui/number-stepper';
import { useToast } from '@/shared/ui/toast';
import { formatPrice } from '@/shared/format';
import { adminRequest, adminUpload, friendlyError } from './admin-request';
import { centsToInput, parsePriceToCents } from './money';

export interface IngredientOption {
  id: string;
  name: string;
  benefit: string;
}

const STEPS = ['Fotos', 'Nome e preço', 'Ingredientes', 'Revisar'] as const;

const input =
  'mt-1 block min-h-14 w-full rounded-lg border border-sage-400 bg-white px-4 text-lg text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-700 aria-[invalid=true]:border-danger';
const primary =
  'inline-flex min-h-14 items-center justify-center rounded-full bg-sage-700 px-8 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:opacity-60';
const secondary =
  'inline-flex min-h-14 items-center justify-center rounded-full border-2 border-sage-700 px-8 text-lg font-semibold text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:opacity-60';

interface Props {
  ingredients: IngredientOption[];
  /** When present the wizard edits this product instead of creating a new one. */
  product?: AdminProductView;
}

export function ProductWizard({ ingredients: initialIngredients, product }: Props) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(product);

  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? centsToInput(product.priceCents) : '');
  const [aroma, setAroma] = useState(product?.aroma ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [usage, setUsage] = useState(product?.usage ?? '');
  const [weight, setWeight] = useState(product?.weightGrams ?? 100);
  const [stock, setStock] = useState(0);
  const [threshold, setThreshold] = useState(product?.lowStockThreshold ?? 3);
  const [selected, setSelected] = useState<string[]>(product?.ingredientIds ?? []);
  const [options, setOptions] = useState(initialIngredients);
  const [newIngredient, setNewIngredient] = useState({ name: '', benefit: '' });
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceCents = parsePriceToCents(price);

  function validateStep2(): boolean {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Dê um nome ao sabonete. Ex.: Sabonete de lavanda';
    if (priceCents === null) next.price = 'Informe o preço. Ex.: 18,00';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function next() {
    setError(null);
    if (step === 1 && !validateStep2()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= 8) break;
        const { url } = await adminUpload(file);
        setImages((all) => [...all, url]);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addIngredient() {
    if (newIngredient.name.trim().length < 2 || newIngredient.benefit.trim().length < 2) {
      setError('Escreva o nome do ingrediente e para que ele serve. Ex.: Aveia — pele sensível');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await adminRequest<IngredientOption>(
        'POST',
        '/admin/ingredients',
        newIngredient,
      );
      setOptions((all) => [...all, created]);
      setSelected((all) => [...all, created.id]);
      setNewIngredient({ name: '', benefit: '' });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!validateStep2() || priceCents === null) {
      setStep(1);
      return;
    }
    setError(null);
    setBusy(true);
    const content = {
      name: name.trim(),
      description,
      usage,
      aroma,
      priceCents,
      weightGrams: weight,
      lowStockThreshold: threshold,
      images,
      ingredientIds: selected,
    };
    try {
      if (product) {
        await adminRequest('PATCH', `/admin/products/${product.id}`, content);
      } else {
        const body: ProductInput = { ...content, stock };
        await adminRequest('POST', '/admin/products', body);
      }
      toast.show({ message: 'Sabonete salvo!', durationMs: 5000 });
      router.push('/painel/sabonetes');
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  const selectedNames = options.filter((o) => selected.includes(o.id)).map((o) => o.name);

  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Passos do cadastro">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`flex-1 rounded-full px-2 py-2 text-center text-base font-semibold ${
              i === step ? 'bg-sage-700 text-cream-50' : 'bg-clay-100 text-ink-900'
            }`}
          >
            <span className="sr-only">Passo </span>
            {i + 1}
            <span className="hidden sm:inline"> · {label}</span>
          </li>
        ))}
      </ol>
      <h2 className="font-heading text-2xl text-sage-700">
        {step + 1}. {STEPS[step]}
      </h2>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-4">
          <p>Fotos com fundo de madeira ou linho ficam lindas. Você pode pular e colocar depois.</p>
          {images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((src) => (
                <li key={src} className="space-y-2 rounded-card bg-clay-100 p-2">
                  <img src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className={`${secondary} min-h-12 w-full px-4`}
                    onClick={() => setImages((all) => all.filter((s) => s !== src))}
                  >
                    Tirar esta foto
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className={`${primary} cursor-pointer`}>
            {busy ? 'Enviando…' : images.length ? 'Adicionar mais fotos' : 'Escolher fotos'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                void onPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="font-semibold text-sage-700">
              Nome do sabonete
            </label>
            <input
              id="name"
              value={name}
              placeholder="Ex.: Sabonete de lavanda"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={input}
            />
            {errors.name ? (
              <p id="name-error" className="mt-1 text-danger">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="price" className="font-semibold text-sage-700">
              Preço (R$)
            </label>
            <input
              id="price"
              inputMode="decimal"
              value={price}
              placeholder="Ex.: 18,00"
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? 'price-error' : undefined}
              className={input}
            />
            {errors.price ? (
              <p id="price-error" className="mt-1 text-danger">
                {errors.price}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="aroma" className="font-semibold text-sage-700">
              Aroma
            </label>
            <input
              id="aroma"
              value={aroma}
              placeholder="Ex.: Floral"
              onChange={(e) => setAroma(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="description" className="font-semibold text-sage-700">
              Conte sobre o sabonete
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              placeholder="Ex.: Feito à mão com óleo essencial de lavanda. Deixa a pele macia e perfumada."
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} py-3`}
            />
          </div>
          <div>
            <label htmlFor="usage" className="font-semibold text-sage-700">
              Como usar
            </label>
            <textarea
              id="usage"
              rows={2}
              value={usage}
              placeholder="Ex.: Use no banho e deixe secar em uma saboneteira com furinhos."
              onChange={(e) => setUsage(e.target.value)}
              className={`${input} py-3`}
            />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sage-700">Peso de cada sabonete (gramas)</p>
            <NumberStepper label="peso" value={weight} min={10} max={1000} onChange={setWeight} />
          </div>
          {!editing ? (
            <div className="space-y-2">
              <p className="font-semibold text-sage-700">Quantos você tem agora?</p>
              <NumberStepper label="quantidade" value={stock} onChange={setStock} />
            </div>
          ) : (
            <p className="rounded-lg bg-clay-100 p-4">
              Para mudar quantos você tem, use os botões + e − na lista de sabonetes.
            </p>
          )}
          <div className="space-y-2">
            <p className="font-semibold text-sage-700">Avisar quando restar</p>
            <NumberStepper
              label="aviso de estoque baixo"
              value={threshold}
              max={100}
              onChange={setThreshold}
            />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="font-semibold text-sage-700">O que vai neste sabonete?</legend>
            {options.length === 0 ? <p>Ainda não há ingredientes. Adicione abaixo.</p> : null}
            {options.map((o) => (
              <label
                key={o.id}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-sage-400 bg-white px-4"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={(e) =>
                    setSelected((all) =>
                      e.target.checked ? [...all, o.id] : all.filter((id) => id !== o.id),
                    )
                  }
                  className="h-6 w-6 accent-sage-700"
                />
                <span className="flex-1">{o.name}</span>
                <span className="text-base text-ink-900/70">{o.benefit}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-3 rounded-card bg-clay-100 p-4">
            <legend className="px-2 font-semibold text-sage-700">Outro ingrediente</legend>
            <div>
              <label htmlFor="ing-name" className="font-semibold">
                Nome
              </label>
              <input
                id="ing-name"
                value={newIngredient.name}
                placeholder="Ex.: Aveia"
                onChange={(e) => setNewIngredient((v) => ({ ...v, name: e.target.value }))}
                className={input}
              />
            </div>
            <div>
              <label htmlFor="ing-benefit" className="font-semibold">
                Para que serve
              </label>
              <input
                id="ing-benefit"
                value={newIngredient.benefit}
                placeholder="Ex.: Pele sensível"
                onChange={(e) => setNewIngredient((v) => ({ ...v, benefit: e.target.value }))}
                className={input}
              />
            </div>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => void addIngredient()}
            >
              Adicionar ingrediente
            </button>
          </fieldset>
        </div>
      ) : null}

      {step === 3 ? (
        <dl className="space-y-3 rounded-card bg-white p-5 shadow-soft">
          <div>
            <dt className="font-semibold text-sage-700">Nome</dt>
            <dd>{name.trim() || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-sage-700">Preço</dt>
            <dd>{priceCents ? formatPrice(priceCents) : '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-sage-700">Fotos</dt>
            <dd>{images.length ? `${images.length} foto(s)` : 'Sem fotos ainda'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-sage-700">Ingredientes</dt>
            <dd>{selectedNames.length ? selectedNames.join(', ') : 'Nenhum escolhido'}</dd>
          </div>
          {!editing ? (
            <div>
              <dt className="font-semibold text-sage-700">Quantos você tem</dt>
              <dd>{stock}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button type="button" className={secondary} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className={primary} onClick={next}>
            Continuar
          </button>
        ) : (
          <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
            {busy ? 'Salvando…' : 'Salvar sabonete'}
          </button>
        )}
      </div>
    </div>
  );
}
