'use client';

import { useEffect, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamBook } from '../api/types';
import { knownBooks, type KnownBook } from '../lib/book-store';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../lib/draft-store';
import { Btn, EmptyLedger, Field, Input, LedgerTabs, formatInviteCode } from '../shell';
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

  /* W2 (PWA-FIX, mục 6.1 + PWA-31): nháp landing bền qua reload.
     {tab, name} → localStorage; MÃ MỜI → sessionStorage CHỈ (mã là
     credential: sống qua reload, chết khi đóng tab, không nằm lâu dài
     trên máy — quyết định bảo mật trong PWA-FIX-STATE). Khôi phục ở
     effect mount (không dùng lazy state để tránh lệch hydration);
     effect persist bỏ qua lần chạy đầu (trước khôi phục) để không ghi
     đè nháp bằng giá trị mặc định. Vào sổ thành công → xoá mã đã lưu. */
  const homeDraftKey = draftKey('home-landing');
  const codeDraftKey = draftKey('home-invite-code');
  const persistArmedRef = useRef(false);

  useEffect(() => {
    const saved = loadDraft<{ tab?: unknown; name?: unknown }>(homeDraftKey);
    if (saved) {
      if (!linkJoinError && (saved.tab === 'create' || saved.tab === 'join')) setTab(saved.tab);
      if (typeof saved.name === 'string') setName(saved.name);
    }
    if (!linkJoinError) {
      const savedCode = loadDraft<{ code?: unknown }>(codeDraftKey, 'session');
      if (savedCode && typeof savedCode.code === 'string' && savedCode.code) {
        setCode(savedCode.code);
      }
    }
    // Chỉ chạy lúc mount; linkJoinError tại thời điểm mount là đủ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!persistArmedRef.current) {
      persistArmedRef.current = true;
      return;
    }
    saveDraft(homeDraftKey, { tab, name });
    if (code) saveDraft(codeDraftKey, { code }, 'session');
    else clearDraft(codeDraftKey, 'session');
  }, [tab, name, code, homeDraftKey, codeDraftKey]);

  /* W2 (mục 3.5 + PWA-16/17): khi bàn phím mở, nút submit phải TỚI
     ĐƯỢC — focus ô tên sổ / mã mời thì sau 350ms (chờ bàn phím trượt
     lên và viewport co lại) cuộn nút submit của ĐÚNG form đang nhập
     vào vùng nhìn bằng scrollIntoView({block:'nearest'}). */
  const revealSubmitOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const submit = e.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit) return;
    window.setTimeout(() => submit.scrollIntoView({ block: 'nearest' }), 350);
  };

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

  /* Hydration discipline (W4, PWA-FIX 5.6): KHÔNG đọc localStorage trong
     lúc render — server luôn render danh sách rỗng, client render lần đầu
     có registry là lệch text với SSR → React #418 cho mọi người dùng cũ.
     Đọc vào state ở effect mount (cùng nhịp với `books` nạp qua API). */
  const [known, setKnown] = useState<KnownBook[]>([]);
  useEffect(() => {
    setKnown(knownBooks());
  }, []);
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
      {/* W2 (PWA-03/3.5): đệm đáy landing gồm safe-area — max(2rem, inset). */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="masthead-rule flex min-h-14 items-center gap-3 pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo là SVG tĩnh trong public/ (asset nội bộ cố định); next/image không tối ưu SVG nên <img> thẳng là đúng */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[10px]"
          />
          <p className="flex-1 font-mono text-[17px] font-bold tracking-[0.18em] uppercase">
            Sổ<span className="text-indigo-700">·</span>Đám
          </p>
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
          {/* W4-2: bỏ segmented-pill ở mặt tiền — chữ trần + gạch mực (LedgerTabs). */}
          <LedgerTabs
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
                onFocus={revealSubmitOnFocus}
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
                .then((err) => {
                  setJoinError(err);
                  // Vào sổ thành công → mã mời không còn là nháp: xoá
                  // bản lưu ở sessionStorage ngay.
                  if (!err) clearDraft(codeDraftKey, 'session');
                })
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Mã mời" error={joinError}>
              <Input
                value={formatInviteCode(code)}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                onFocus={revealSubmitOnFocus}
                placeholder="VD: A1B2 C3D4 E5F6 G7H8"
                // F11 (Panel R1): khi có lỗi, VIỀN Ô theo lỗi (đỏ) —
                // không để viền focus xanh dương đánh nhau với dòng lỗi.
                className={
                  joinError
                    ? 'border-lacquer font-mono tracking-wide uppercase focus:border-lacquer focus:ring-lacquer'
                    : 'font-mono tracking-wide uppercase'
                }
                style={joinError ? { borderColor: '#D1242F' } : undefined}
                aria-invalid={joinError ? true : undefined}
                // W2 (mục 3.2 + PWA-13): mã mời là mã dùng một lần gồm
                // chữ + số → one-time-code + tự viết hoa, KHÔNG ép
                // inputmode numeric.
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
            <p className="text-sm text-muted">
              Mã gồm 16 ký tự, tự tách nhóm 4 cho dễ đọc — dán nguyên mã vào cũng được. Mở link chia
              sẻ là vào thẳng, không cần nhập mã.
            </p>
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
            <div className="mt-2 rounded-[7px] border border-line bg-card">
              <EmptyLedger
                title="Chưa có sổ nào"
                body="Tạo sổ đầu tiên ở trên để bắt đầu ghi lễ cho nhà mình."
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-[7px] border border-line bg-card">
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

        {/* F13 (Panel R1): BỎ pill «Còn … ngày tới Tết» — chi tiết lạc
            hệ, vô cớ trong app sổ tiền, lại bị cắt mép ở đáy trang. */}
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
        <InfoSections />
      </div>
    </div>
  );
}
