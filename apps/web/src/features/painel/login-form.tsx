'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminRequest, friendlyError } from './admin-request';

const field =
  'mt-1 block min-h-14 w-full rounded-lg border border-sage-400 bg-white px-4 text-lg text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-700';

/** Only same-site paths are allowed as the post-login destination. */
export function safeNext(next: string | undefined): string {
  return next && next.startsWith('/painel') && !next.startsWith('//') ? next : '/painel';
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Digite o seu e-mail e a sua senha.');
      return;
    }
    setBusy(true);
    try {
      await adminRequest('POST', '/admin/auth/login', { email, password, remember });
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="font-semibold text-sage-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="font-semibold text-sage-700">
          Senha
        </label>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        <label className="mt-2 flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className="h-6 w-6 accent-sage-700"
          />
          Mostrar a senha
        </label>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-6 w-6 accent-sage-700"
        />
        Lembrar de mim por 30 dias
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-sage-700 text-xl font-semibold text-cream-50 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:opacity-60"
      >
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
