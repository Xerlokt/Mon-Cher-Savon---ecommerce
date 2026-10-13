'use client';

import { Minus, Plus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const buttonClass =
  'inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-sage-700 text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:cursor-not-allowed disabled:opacity-40';

/** Big − / + buttons with the number between them; no typing needed. */
export function NumberStepper({ label, value, onChange, min = 0, max = 100_000 }: Props) {
  return (
    <div className="flex items-center gap-4" role="group" aria-label={label}>
      <button
        type="button"
        className={buttonClass}
        aria-label={`Diminuir ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus aria-hidden size={24} />
      </button>
      <output className="min-w-12 text-center text-3xl font-bold text-ink-900" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={buttonClass}
        aria-label={`Aumentar ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus aria-hidden size={24} />
      </button>
    </div>
  );
}
