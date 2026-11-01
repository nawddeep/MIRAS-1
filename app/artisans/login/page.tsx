'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';

export default function ArtisanLoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const res = await communityRequest<{ ok: true; user: Member }>('/api/account', {
        action: 'login',
        username,
        password,
      });

      if (res.user.role !== 'artisan') {
        // If user logged in with personal account, let them know or redirect
        router.push('/artisan/dashboard');
      } else {
        router.push('/artisan/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-6">
      <header className="space-y-2 text-center">
        <p className="discovery-eyebrow">MIRAS ARTISAN PORTAL</p>
        <h1 className="text-3xl font-display">Artisan Sign In</h1>
        <p className="text-sm text-muted-paper">
          Access your workshop, manage craft listings, and reply to visitor enquiries.
        </p>
      </header>

      {error && <p role="alert" className="social-error">{error}</p>}

      <div className="bg-white p-6 rounded-3xl border border-line shadow-sm">
        <form onSubmit={handleSubmit} className="social-form space-y-4">
          <label className="block text-sm font-medium">
            Artisan Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1 w-full"
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              required
              type="password"
              maxLength={128}
              autoComplete="current-password"
              className="mt-1 w-full"
            />
          </label>

          <button className="feature-primary w-full py-3" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to Artisan Dashboard'}
          </button>
        </form>
      </div>

      <div className="text-center space-y-2 text-xs text-muted-paper">
        <p>
          Don’t have an artisan shop listing yet?{' '}
          <Link href="/artisans/register" className="font-semibold text-ink underline">
            Register your craft shop ↗
          </Link>
        </p>
        <p>
          <Link href="/account" className="underline">
            General account &amp; password recovery
          </Link>
        </p>
      </div>
    </div>
  );
}
