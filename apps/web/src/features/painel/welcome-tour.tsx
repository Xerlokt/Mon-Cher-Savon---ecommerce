'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

export const TOUR_STORAGE_KEY = 'mon-cher-savon:painel-tour:v1';

const STEPS = [
  {
    title: 'Bem-vinda ao seu painel!',
    text: 'Aqui você vê o que vendeu, o que precisa enviar e o que está acabando. São só 4 abas lá embaixo.',
  },
  {
    title: 'Vendas',
    text: 'Quando alguém compra, a venda aparece aqui e você recebe um aviso no celular. Depois de enviar, toque em "Marquei como enviado".',
  },
  {
    title: 'Meus sabonetes',
    text: 'Cadastre sabonetes novos, mude preços e use os botões + e − para dizer quantos você tem.',
  },
  {
    title: 'Configurações',
    text: 'Escolha onde receber os avisos de venda (Telegram ou WhatsApp) e teste com um toque. Se travar, toque no ? de cada cartão.',
  },
] as const;

/** Shown once, on the first visit (remembered in this browser). */
export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_STORAGE_KEY)) setOpen(true);
    } catch {
      // Blocked storage: skip the tour instead of showing it on every visit.
    }
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    } catch {
      // ignore
    }
    setOpen(false);
  }

  const last = step === STEPS.length - 1;
  const current = STEPS[step] ?? STEPS[0];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-card bg-cream-50 p-6 shadow-soft focus:outline-none">
          <p className="text-base text-ink-900/70">
            Passo {step + 1} de {STEPS.length}
          </p>
          <Dialog.Title className="font-heading text-2xl text-sage-700">
            {current.title}
          </Dialog.Title>
          <Dialog.Description className="text-lg">{current.text}</Dialog.Description>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className="min-h-14 rounded-full bg-sage-700 px-8 text-lg font-semibold text-cream-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600"
            >
              {last ? 'Começar' : 'Próximo'}
            </button>
            {!last ? (
              <button
                type="button"
                onClick={finish}
                className="min-h-14 rounded-full border-2 border-sage-700 px-8 text-lg font-semibold text-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
              >
                Pular
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
