'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import { adminRequest, friendlyError } from './admin-request';

const secondary =
  'inline-flex min-h-12 items-center justify-center rounded-full border-2 border-sage-700 px-5 text-lg font-semibold text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700';
const dangerClass =
  'inline-flex min-h-12 items-center justify-center rounded-full border-2 border-danger px-5 text-lg font-semibold text-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger';

/** "Tirar da loja": archives (never deletes) and offers Desfazer for 10 seconds. */
export function RemoveFromStoreButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await adminRequest('DELETE', `/admin/products/${productId}`);
      setOpen(false);
      router.refresh();
      toast.show({
        message: `"${name}" saiu da loja.`,
        actionLabel: 'Desfazer',
        durationMs: 10_000,
        onAction: async () => {
          try {
            await adminRequest('POST', `/admin/products/${productId}/restore`);
            router.refresh();
          } catch (error) {
            toast.show({ message: friendlyError(error), tone: 'error', durationMs: 7000 });
          }
        },
      });
    } catch (error) {
      toast.show({ message: friendlyError(error), tone: 'error', durationMs: 7000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={dangerClass} onClick={() => setOpen(true)}>
        Tirar da loja
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Tirar "${name}" da loja?`}
        description="Ele deixa de aparecer para os clientes, mas as vendas antigas continuam guardadas. Você pode colocar de volta quando quiser."
        confirmLabel="Sim, tirar da loja"
        tone="danger"
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}

export function PutBackButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      await adminRequest('POST', `/admin/products/${productId}/restore`);
      toast.show({ message: `"${name}" voltou para a loja.`, durationMs: 5000 });
      router.refresh();
    } catch (error) {
      toast.show({ message: friendlyError(error), tone: 'error', durationMs: 7000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={secondary} disabled={busy} onClick={restore}>
      Colocar de volta na loja
    </button>
  );
}
