'use client';

import { useEffect, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamBook } from '../api/types';
import { knownBooks } from '../lib/book-store';
import { solarToLunar } from '../lib/lunar';
import { Btn, EmptyLedger, Field, Input, SegmentedTabs, formatInviteCode } from '../shell';
import { BookAvatar } from '../ui/avatar';
import { OfflineBanner } from '../ui/offline-ui';
import InfoSections from '@/components/seo/InfoSections';
import { ChevronRight } from 'lucide-react';
import { money } from '../app-shared';

export function HomeView({
  api,
  books,
  online,
  linkJoinError,
  error,
  onRetryBooks,
  onCreate,
  onJoin,
  onOpen,
}: {
  api: SodamApi;
  books: SodamBook[];
  online: boolean;
  linkJoinError: { code: string; message: string } | null;
  error: string | null;
  onRetryBooks: () => void;
  onCreate: (name: string) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState(linkJoinError ? 'join' : 'create');
  const [name, setName] = useState('');
  const [code, setCode] = useState(linkJoinError?.code ?? '');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(linkJoinError?.message ?? null);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [shareCopied, setShareCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState<string | null>(null);

  useEffect(() => {
    if (linkJoinError) {
      setTab('join');
      setCode(linkJoinError.code);
      setJoinError(linkJoinError.message);
    }
  }, [linkJoinError]);

  // Tổng đã nhận của từng sổ (để hàng sổ đủ thông tin) — lỗi thì bỏ qua, hàng vẫn mở được.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, number> = {};
      await Promise.allSettled(
        books.map(async (b) => {
          const dash = await api.dashboard(b.id);
          next[b.id] = dash.totals.receivedGrossVnd ?? dash.totals.receivedVnd;
        }),
      );
      if (!cancelled) setTotals(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, books]);

  const known = knownBooks();
  const shownBooks: Array<{ id: string; name: string; inviteCode: string }> =
    books.length > 0
      ? books
      : known.map((k) => ({ id: k.id, name: k.name ?? 'Sổ Đám', inviteCode: k.inviteCode }));

  const shareApp = () => {
    const link = window.location.origin;
    void (async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Sổ Đám', url: link });
          return;
        } catch {
          // Huỷ share sheet — rơi xuống chép link.
        }
      }
      try {
        await navigator.clipboard.writeText(link);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2500);
      } catch {
        setShareFallback(link);
      }
    })();
  };

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <header className="flex min-h-14 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo là SVG tĩnh trong public/ (asset nội bộ cố định); next/image không tối ưu SVG nên <img> thẳng là đúng */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[10px]"
          />
          <p className="flex-1 text-[17px] font-semibold">Sổ Đám</p>
          <span className="relative">
            <button
              type="button"
              onClick={shareApp}
              className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {shareCopied ? 'Đã chép link' : 'Chia sẻ app'}
            </button>
            {shareFallback ? (
              <span className="absolute top-full right-0 z-10 mt-1 block w-64 rounded-lg border border-line bg-card p-2 font-mono text-xs break-all text-ink">
                {shareFallback}
              </span>
            ) : null}
          </span>
        </header>

        <OfflineBanner online={online} />

        <h1 className="mt-4 text-[28px] leading-[34px] font-bold tracking-tight">
          Sổ ghi tiền đám của nhà mình.
        </h1>

        <div className="mt-5">
          <SegmentedTabs
            ariaLabel="Tạo sổ hoặc vào bằng mã"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'create', label: 'Tạo sổ' },
              { id: 'join', label: 'Vào bằng mã' },
            ]}
          />
        </div>

        {tab === 'create' ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              void onCreate(name.trim())
                .then((err) => setCreateError(err))
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Tên sổ" error={createError}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Sổ nhà, Sổ cưới 2026"
                autoComplete="off"
              />
            </Field>
            <Btn type="submit" disabled={busy} className="min-h-12 w-full">
              {createError && !online ? 'Thử lại' : 'Tạo sổ & mở'}
            </Btn>
          </form>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || code.replace(/\s/g, '').length < 3) return;
              setBusy(true);
              void onJoin(code)
                .then((err) => setJoinError(err))
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Mã mời" error={joinError}>
              <Input
                value={formatInviteCode(code)}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                placeholder="VD: A1B2 C3D4 E5F6 G7H8"
                className="font-mono tracking-wide uppercase"
                autoComplete="off"
              />
            </Field>
            <p className="text-sm text-muted">Mở link chia sẻ là vào thẳng, không cần nhập mã.</p>
            <Btn type="submit" disabled={busy} className="min-h-12 w-full">
              Vào sổ
            </Btn>
          </form>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-lacquer bg-card px-3 py-3" role="alert">
            <p className="text-sm">{error}</p>
            <Btn variant="secondary" className="mt-2" onClick={onRetryBooks}>
              Thử lại
            </Btn>
          </div>
        ) : null}

        <section aria-label="Sổ đã mở trên máy này" className="mt-8">
          <h2 className="text-[17px] font-semibold">
            Sổ đã mở trên máy này{' '}
            <span className="font-normal text-muted">({shownBooks.length})</span>
          </h2>
          {shownBooks.length === 0 ? (
            <div className="mt-2 rounded-xl border border-line bg-card">
              <EmptyLedger
                title="Chưa có sổ nào"
                body="Tạo sổ đầu tiên ở trên để bắt đầu ghi lễ cho nhà mình."
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-card">
              {shownBooks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(b.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                  >
                    <BookAvatar name={b.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug font-medium [overflow-wrap:anywhere] text-ink">
                        {b.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted">
                        mã ···· {b.inviteCode.replace(/\s/g, '').slice(-4)}
                      </span>
                    </span>
                    {totals[b.id] != null ? (
                      <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                        {money(totals[b.id]!)}
                      </span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SeasonStrip />
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
        <InfoSections />
      </div>
    </div>
  );
}

/** Tìm Tết Nguyên đán kế tiếp bằng lịch âm Việt (lib/lunar) — quét tối đa 400 ngày. */
function nextTet(from: Date): { date: Date; days: number } | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const lunar = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    if (lunar.day === 1 && lunar.month === 1) return { date: d, days: i };
  }
  return null;
}

/** Dải mùa lễ 1 hàng: đếm ngày tới Tết theo âm lịch thật. */
function SeasonStrip() {
  const tet = nextTet(new Date());
  if (!tet) return null;
  const fmt = `${tet.date.getDate()}/${tet.date.getMonth() + 1}`;
  return (
    <p className="mt-6 flex min-h-10 items-center gap-2 rounded-xl border border-line bg-card px-3.5 text-sm text-muted">
      <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm bg-gold" />
      Còn <span className="font-mono font-semibold text-ink">{tet.days} ngày</span> tới Tết Nguyên
      đán ({fmt})
    </p>
  );
}
