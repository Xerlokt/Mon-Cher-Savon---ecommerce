import type { Metadata } from 'next';
import { Fraunces, Nunito_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const nunito = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env['SITE_URL'] ?? 'http://localhost:3000'),
  title: { default: 'Mon Cher Savon — sabonetes artesanais', template: '%s · Mon Cher Savon' },
  description:
    'Sabonetes artesanais feitos à mão com ingredientes naturais: lavanda, argila, karité e mais.',
  openGraph: { siteName: 'Mon Cher Savon', locale: 'pt_BR', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
