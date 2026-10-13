'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminRequest } from './admin-request';

const secondary =
  'inline-flex min-h-14 items-center justify-center rounded-full border-2 border-sage-700 px-8 text-lg font-semibold text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await adminRequest('POST', '/admin/auth/logout');
    } finally {
      router.replace('/painel/entrar');
      router.refresh();
    }
  }

  return (
    <button type="button" className={secondary} disabled={busy} onClick={() => void logout()}>
      Sair do painel
    </button>
  );
}

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

/** "Instalar no celular": uses the browser prompt when available, otherwise explains how. */
export function InstallAppButton() {
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!event) {
    return (
      <p>
        Para ter o painel como um aplicativo no celular: abra o menu do navegador e toque em{' '}
        <strong>Adicionar à tela inicial</strong> (ou <strong>Instalar aplicativo</strong>).
      </p>
    );
  }
  return (
    <button type="button" className={secondary} onClick={() => void event.prompt()}>
      Instalar no celular
    </button>
  );
}
