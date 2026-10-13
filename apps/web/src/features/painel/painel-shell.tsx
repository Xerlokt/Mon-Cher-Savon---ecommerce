'use client';

import { ClipboardList, Home, Package, Settings, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ToastProvider } from '@/shared/ui/toast';
import { WelcomeTour } from './welcome-tour';

export const TABS: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { href: '/painel', label: 'Início', icon: Home, exact: true },
  { href: '/painel/vendas', label: 'Vendas', icon: ClipboardList },
  { href: '/painel/sabonetes', label: 'Meus sabonetes', icon: Package },
  { href: '/painel/configuracoes', label: 'Configurações', icon: Settings },
];

export function isActiveTab(pathname: string, tab: { href: string; exact?: boolean }): boolean {
  return tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/** Four always-visible tabs: bottom bar on phones, side menu on larger screens. */
export function PainelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/painel-sw.js', { scope: '/painel/' })
        .catch(() => undefined);
    }
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-screen md:flex">
        <nav
          aria-label="Painel"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-clay-100 bg-cream-50 md:static md:inset-auto md:w-64 md:shrink-0 md:border-r md:border-t-0"
        >
          <p className="hidden px-6 pb-2 pt-6 font-heading text-xl text-sage-700 md:block">
            Mon Cher Savon
          </p>
          <ul className="grid grid-cols-4 md:block md:space-y-1 md:p-3">
            {TABS.map((tab) => {
              const active = isActiveTab(pathname, tab);
              const Icon = tab.icon;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage-700 md:min-h-14 md:flex-row md:justify-start md:gap-3 md:rounded-full md:px-5 md:text-lg ${
                      active ? 'bg-sage-700 text-cream-50' : 'text-sage-700 hover:bg-clay-100'
                    }`}
                  >
                    <Icon aria-hidden size={24} />
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10">
          <div className="mx-auto max-w-3xl space-y-6">{children}</div>
        </main>
      </div>
      <WelcomeTour />
    </ToastProvider>
  );
}
