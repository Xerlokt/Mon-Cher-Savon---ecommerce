'use client';

import * as Dialog from '@radix-ui/react-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Confirmation written as a plain sentence, with action-named buttons (never "OK"). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'primary',
  busy = false,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-card bg-cream-50 p-6 shadow-soft focus:outline-none">
          <Dialog.Title className="font-heading text-2xl text-sage-700">{title}</Dialog.Title>
          <Dialog.Description className="text-lg">{description}</Dialog.Description>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onConfirm()}
              className={`min-h-12 rounded-full px-6 text-lg font-semibold text-cream-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:opacity-60 ${
                tone === 'danger' ? 'bg-danger' : 'bg-sage-700'
              }`}
            >
              {confirmLabel}
            </button>
            <Dialog.Close className="min-h-12 rounded-full border border-sage-700 px-6 text-lg font-semibold text-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700">
              {cancelLabel}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
