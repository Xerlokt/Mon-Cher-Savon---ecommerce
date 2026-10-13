'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import { adminRequest, friendlyError } from './admin-request';

type Status = 'AWAITING_PAYMENT' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

const primary =
  'inline-flex min-h-14 w-full items-center justify-center rounded-full bg-sage-700 px-6 text-lg font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:opacity-60';
const danger =
  'inline-flex min-h-12 items-center justify-center rounded-full border-2 border-danger px-6 text-lg font-semibold text-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger';

export function OrderActions({
  orderId,
  status,
  compact = false,
}: {
  orderId: string;
  status: Status;
  /** In lists only the main action is shown. */
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function change(next: 'SHIPPED' | 'DELIVERED' | 'CANCELLED', success: string) {
    setBusy(true);
    try {
      await adminRequest('PATCH', `/admin/orders/${orderId}/status`, { status: next });
      toast.show({ message: success, durationMs: 5000 });
      setConfirmCancel(false);
      router.refresh();
    } catch (error) {
      toast.show({ message: friendlyError(error), tone: 'error', durationMs: 7000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {status === 'PAID' ? (
        <button
          type="button"
          className={primary}
          disabled={busy}
          onClick={() => change('SHIPPED', 'Pronto! Marcado como enviado.')}
        >
          Marquei como enviado
        </button>
      ) : null}
      {status === 'SHIPPED' ? (
        <button
          type="button"
          className={primary}
          disabled={busy}
          onClick={() => change('DELIVERED', 'Pronto! Marcado como entregue.')}
        >
          Marquei como entregue
        </button>
      ) : null}
      {!compact && (status === 'PAID' || status === 'AWAITING_PAYMENT') ? (
        <>
          <button type="button" className={danger} onClick={() => setConfirmCancel(true)}>
            Cancelar esta venda
          </button>
          <ConfirmDialog
            open={confirmCancel}
            onOpenChange={setConfirmCancel}
            title="Cancelar esta venda?"
            description={
              status === 'PAID'
                ? 'Os sabonetes voltam para o seu estoque. Se o cliente já pagou, o reembolso você faz direto no Mercado Pago.'
                : 'O cliente ainda não pagou. A venda sai da lista.'
            }
            confirmLabel="Sim, cancelar a venda"
            tone="danger"
            busy={busy}
            onConfirm={() => change('CANCELLED', 'Venda cancelada.')}
          />
        </>
      ) : null}
    </div>
  );
}
