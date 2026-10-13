'use client';

import * as Popover from '@radix-ui/react-popover';
import { CircleHelp } from 'lucide-react';

/** The "?" icon on each card with a one-sentence explanation. */
export function HelpHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Ajuda: ${label}`}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full text-sage-700 hover:bg-clay-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
      >
        <CircleHelp aria-hidden size={24} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-card bg-ink-900 p-4 text-base text-cream-50 shadow-soft"
        >
          {children}
          <Popover.Arrow className="fill-ink-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
