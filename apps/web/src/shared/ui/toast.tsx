'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ToastInput {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
  tone?: 'info' | 'error';
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

/** Short messages with an optional action such as "Desfazer" (10 seconds by default). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (toast: ToastInput) => {
      const id = ++counter.current;
      setItems((all) => [...all, { ...toast, id }]);
    },
    [setItems],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.durationMs ?? 10_000);
    return () => clearTimeout(timer);
  }, [item.durationMs, onDismiss]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-card px-5 py-4 text-cream-50 shadow-soft ${
        item.tone === 'error' ? 'bg-danger' : 'bg-ink-900'
      }`}
    >
      <span>{item.message}</span>
      {item.actionLabel ? (
        <button
          type="button"
          onClick={async () => {
            onDismiss();
            await item.onAction?.();
          }}
          className="min-h-12 rounded-full border border-cream-50 px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
        >
          {item.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
