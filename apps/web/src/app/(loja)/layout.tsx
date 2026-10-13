import Link from 'next/link';
import { CartBottomBar, CartDrawer, CartLauncher } from '@/features/carrinho/cart-drawer';
import { CartProvider } from '@/features/carrinho/cart-provider';

const nav = [
  { href: '/catalogo', label: 'Sabonetes' },
  { href: '/sobre', label: 'A artesã' },
];

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-sage-700 focus:px-4 focus:py-2 focus:text-cream-50"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-clay-100 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-2 px-4 py-2 md:py-3">
          <Link href="/" className="font-heading text-2xl text-sage-700">
            Mon Cher Savon
          </Link>
          <nav aria-label="Principal" className="order-last w-full md:order-none md:w-auto">
            <ul className="flex gap-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-sage-700 hover:bg-clay-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <CartLauncher />
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
      <footer className="mt-12 bg-clay-100">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm">
          <p className="font-heading text-lg text-sage-700">Mon Cher Savon</p>
          <p>Sabonetes artesanais feitos à mão, em pequenos lotes.</p>
          <p className="flex flex-wrap gap-x-4">
            <Link
              href="/politicas/privacidade"
              className="inline-flex min-h-11 items-center underline"
            >
              Privacidade
            </Link>
            <Link href="/politicas/trocas" className="inline-flex min-h-11 items-center underline">
              Trocas e devoluções
            </Link>
          </p>
        </div>
      </footer>
      <CartDrawer />
      <CartBottomBar />
    </CartProvider>
  );
}
