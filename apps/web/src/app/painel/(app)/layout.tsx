import { PainelShell } from '@/features/painel/painel-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <PainelShell>{children}</PainelShell>;
}
