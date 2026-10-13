'use client';

import type { NotificationSettingResponse } from '@mon-cher-savon/contracts';
import { useState } from 'react';
import { useToast } from '@/shared/ui/toast';
import { adminRequest, friendlyError } from './admin-request';

const COPY = {
  telegram: {
    title: 'Telegram',
    hint: 'Grátis e o jeito mais fácil. Abra o seu robô no Telegram, toque em Iniciar e cole aqui o número do seu chat (só números).',
    placeholder: 'Ex.: 123456789',
    label: 'Número do chat do Telegram',
  },
  whatsapp: {
    title: 'WhatsApp',
    hint: 'Usa o WhatsApp oficial da Meta e pode ter custo por conversa. Digite o número com DDD.',
    placeholder: 'Ex.: 11 91234-5678',
    label: 'Número do WhatsApp',
  },
} as const;

const button =
  'inline-flex min-h-14 items-center justify-center rounded-full px-6 text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 disabled:opacity-60';

function ChannelCard({ initial }: { initial: NotificationSettingResponse }) {
  const copy = COPY[initial.channel];
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [destination, setDestination] = useState(initial.destination);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const id = `dest-${initial.channel}`;

  async function save(): Promise<boolean> {
    setError(null);
    setBusy('save');
    try {
      const saved = await adminRequest<{ destination: string; enabled: boolean }>(
        'PUT',
        '/admin/notifications/settings',
        { channel: initial.channel, enabled, destination },
      );
      setDestination(saved.destination);
      toast.show({ message: `${copy.title} salvo!`, durationMs: 4000 });
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setError(null);
    setBusy('test');
    try {
      await adminRequest('POST', '/admin/notifications/test', { channel: initial.channel });
      toast.show({
        message: `Mensagem enviada! Olhe o seu ${copy.title}.`,
        durationMs: 6000,
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-4 rounded-card bg-white p-6 shadow-soft"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={`${id}-title`} className="font-heading text-2xl text-sage-700">
          {copy.title}
        </h2>
        {initial.available ? (
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-7 w-7 accent-sage-700"
            />
            Avisar aqui
          </label>
        ) : null}
      </div>
      {!initial.available ? (
        <p className="rounded-lg bg-clay-100 p-4">
          Este canal ainda não foi ativado no servidor. Peça a quem cuida da loja para configurar.
        </p>
      ) : (
        <>
          <p>{copy.hint}</p>
          <div>
            <label htmlFor={id} className="font-semibold text-sage-700">
              {copy.label}
            </label>
            <input
              id={id}
              inputMode="numeric"
              value={destination}
              placeholder={copy.placeholder}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 block min-h-14 w-full rounded-lg border border-sage-400 px-4 text-lg"
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={`${button} bg-sage-700 text-cream-50`}
              disabled={busy !== null}
              onClick={() => void save()}
            >
              Salvar
            </button>
            <button
              type="button"
              className={`${button} border-2 border-sage-700 text-sage-700`}
              disabled={busy !== null || !destination}
              onClick={() => void sendTest()}
            >
              Enviar mensagem de teste
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function NotificationSettings({ settings }: { settings: NotificationSettingResponse[] }) {
  return (
    <div className="space-y-6">
      {settings.map((s) => (
        <ChannelCard key={s.channel} initial={s} />
      ))}
    </div>
  );
}
