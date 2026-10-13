'use client';

import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/shared/ui/toast';
import { adminRequest, friendlyError } from './admin-request';

const buttonClass =
  'inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-sage-700 text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:cursor-not-allowed disabled:opacity-40';

/** "Quantos tenho": big number with − and + that saves instantly and records the reason. */
export function StockStepper({
  productId,
  name,
  initialStock,
}: {
  productId: string;
  name: string;
  initialStock: number;
}) {
  const [stock, setStock] = useState(initialStock);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function change(delta: 1 | -1) {
    const previous = stock;
    setStock(previous + delta); // optimistic
    setBusy(true);
    try {
      const result = await adminRequest<{ stock: number }>(
        'POST',
        `/admin/products/${productId}/stock-adjustments`,
        { delta, reason: delta > 0 ? 'RESTOCK' : 'ADJUSTMENT' },
      );
      setStock(result.stock);
    } catch (error) {
      setStock(previous);
      toast.show({ message: friendlyError(error), tone: 'error', durationMs: 6000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3" role="group" aria-label={`Quantos tenho: ${name}`}>
      <button
        type="button"
        className={buttonClass}
        aria-label={`Tirar um ${name}`}
        disabled={busy || stock <= 0}
        onClick={() => change(-1)}
      >
        <Minus aria-hidden size={24} />
      </button>
      <output className="min-w-14 text-center text-4xl font-bold text-ink-900" aria-live="polite">
        {stock}
      </output>
      <button
        type="button"
        className={buttonClass}
        aria-label={`Colocar mais um ${name}`}
        disabled={busy}
        onClick={() => change(1)}
      >
        <Plus aria-hidden size={24} />
      </button>
    </div>
  );
}
