import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s · Painel Mon Cher Savon' },
  robots: { index: false, follow: false },
  manifest: '/painel/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mon Cher Savon', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#3F5A43' };

/** Panel base font is 18 px (the store uses 16 px). */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '18px' }}>{children}</div>;
}
