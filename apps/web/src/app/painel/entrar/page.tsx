import type { Metadata } from 'next';
import { LoginForm } from '@/features/painel/login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-4 py-10">
      <header className="space-y-2 text-center">
        <p className="font-heading text-3xl text-sage-700">Mon Cher Savon</p>
        <h1 className="text-2xl">Entrar no painel</h1>
      </header>
      <div className="rounded-card bg-white p-6 shadow-soft">
        <LoginForm {...(typeof next === 'string' ? { next } : {})} />
      </div>
    </main>
  );
}
