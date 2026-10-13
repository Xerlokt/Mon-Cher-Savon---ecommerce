import type { NotificationSettingResponse } from '@mon-cher-savon/contracts';
import { InstallAppButton, LogoutButton } from '@/features/painel/account-buttons';
import { NotificationSettings } from '@/features/painel/notification-settings';
import { adminGet } from '@/features/painel/server-api';
import { LoadError, PageTitle, PanelCard } from '@/features/painel/ui';

export const metadata = { title: 'Configurações' };

export default async function SettingsPage() {
  let settings: NotificationSettingResponse[];
  try {
    settings = await adminGet<NotificationSettingResponse[]>('/admin/notifications/settings');
  } catch {
    return (
      <>
        <PageTitle>Configurações</PageTitle>
        <LoadError />
      </>
    );
  }
  return (
    <>
      <PageTitle>Configurações</PageTitle>
      <h2 className="font-heading text-2xl text-sage-700">Avisos de venda</h2>
      <p>Escolha onde quer receber a mensagem quando alguém comprar.</p>
      <NotificationSettings settings={settings} />

      <PanelCard
        id="app"
        title="Painel no celular"
        help="Instalar deixa um ícone do painel na tela inicial, como um aplicativo."
      >
        <InstallAppButton />
      </PanelCard>

      <LogoutButton />
    </>
  );
}
