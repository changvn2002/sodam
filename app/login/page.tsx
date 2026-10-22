'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveToken } from '@/lib/api';

/**
 * Built-in auth page for the standalone build (the host used Changtotech
 * accounts). One page, two modes: login and register — both return a JWT
 * that is stored by `lib/api` and sent as a Bearer token to the API routes.
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    params.get('register') === '1' ? 'register' : 'login',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!res.ok || !data.token) {
        throw new Error(data.message ?? 'Đăng nhập thất bại');
      }
      saveToken(data.token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px 420px at 20% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 55%), var(--paper)',
        }}
      />
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-[0_1px_0_rgba(16,20,24,0.04)] sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Sổ Đám</p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink">
          {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Tài khoản dùng để giữ sổ của riêng bạn — dữ liệu tiền mừng không công khai, chỉ thành viên
          được mời bằng mã sổ mới xem được.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Tên hiển thị</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-gold"
                placeholder="Ví dụ: Nguyễn Văn A"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-gold"
              placeholder="ban@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Mật khẩu</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-gold"
              placeholder="Ít nhất 8 ký tự"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-lacquer/40 bg-lacquer/10 px-3 py-2 text-sm text-lacquer"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-jade-deep px-4 text-sm font-medium text-[#FAF6EF] transition-colors hover:bg-jade-deep/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"
          >
            {busy ? 'Đang xử lý…' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
          className="mt-4 w-full text-center text-sm text-muted underline-offset-2 hover:underline"
        >
          {mode === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Tạo mới'}
        </button>
        <Link
          href="/"
          className="mt-2 block text-center text-sm text-muted underline-offset-2 hover:underline"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
