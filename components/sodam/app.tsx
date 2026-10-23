'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSodamApi, resolveSodamApiMode, type SodamApi } from './api';
import type {
  SodamBook,
  SodamDashboard,
  SodamEntry,
  SodamEvent,
  SodamEventKind,
  SodamEventRole,
  SodamParseResult,
  SodamPerson,
  SodamRelation,
  SodamRelationType,
  SodamReturnItem,
} from './api/types';
import { cn } from '@/lib/utils';
import { knownBookCodes, rememberBook } from './lib/book-store';
import { useSodamOffline } from './lib/offline';
import { EVENT_KIND_LABELS, EVENT_KIND_ORDER, kindLabel } from './lib/event-kinds';
import { lexiconForKind, sourceLabel } from './lib/lexicon';
import { formatLunarVi, solarToLunar } from './lib/lunar';
import {
  Btn,
  EmptyLedger,
  Field,
  Input,
  KpiBand,
  SegmentedTabs,
  Select,
  Sheet,
  SodamShell,
  StatusPill,
  StickyActionBar,
  formatInviteCode,
  type SodamNavId,
} from './shell';
import { BookAvatar, PersonAvatar } from './ui/avatar';
import { LedgerRow } from './ui/ledger-row';
import { OutboxChip } from './ui/offline-ui';
import InfoSections from '@/components/seo/InfoSections';
import { Mic, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react';

type View =
  | { name: 'home' }
  | { name: 'dashboard'; bookId: string }
  | { name: 'event'; bookId: string; eventId: string }
  | { name: 'returns'; bookId: string }
  | { name: 'tree'; bookId: string }
  | { name: 'people'; bookId: string };

const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Chuỗi lỗi thô của fetch không bao giờ tới UI (F-W5-05) — ánh xạ sang tiếng Việt. */
function friendlyError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.';
  }
  return msg || fallback;
}

/** Mốc tiền mừng quen thuộc — chỉ điền khi người dùng chạm vào. */
const QUICK_AMOUNTS = [100_000, 200_000, 300_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

const formatAmountInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
};

function QuickAmounts({ onPick }: { onPick: (value: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh số tiền">
      {QUICK_AMOUNTS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-card px-3 font-mono text-[13px] font-medium tabular-nums text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {money(v)}
        </button>
      ))}
    </div>
  );
}

/** Ngày dương (để hiển thị) + ngày âm tương ứng của một sự kiện. */
function eventDateLabels(occurredOn?: string): { solar: string; lunar: string } | null {
  if (!occurredOn) return null;
  let day: number;
  let month: number;
  let year: number;
  const m = occurredOn.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else {
    const dt = new Date(occurredOn);
    if (Number.isNaN(dt.getTime())) return null;
    day = dt.getDate();
    month = dt.getMonth() + 1;
    year = dt.getFullYear();
  }
  const solar = `${day}/${month}/${year}`;
  try {
    const l = solarToLunar(day, month, year);
    return { solar, lunar: formatLunarVi(l.day, l.month, l.leap) };
  } catch {
    return { solar, lunar: '' };
  }
}

function EventKindPicker({
  value,
  onChange,
}: {
  value: SodamEventKind;
  onChange: (kind: SodamEventKind) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Loại đám">
      {EVENT_KIND_ORDER.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(k)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-[10px] border px-2 text-center text-[13px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              active
                ? 'border-indigo-700 bg-indigo-700 font-semibold text-white'
                : 'border-line-strong bg-card text-ink hover:bg-indigo-50',
            )}
          >
            {EVENT_KIND_LABELS[k] ?? kindLabel(k)}
          </button>
        );
      })}
    </div>
  );
}

function navFromView(view: View): SodamNavId {
  if (view.name === 'home') return 'home';
  if (view.name === 'returns') return 'returns';
  if (view.name === 'people') return 'people';
  if (view.name === 'tree') return 'tree';
  if (view.name === 'event') return 'event';
  return 'overview';
}

export function SodamApp() {
  const api = useMemo(() => createSodamApi(), []);
  const mode = resolveSodamApiMode();
  const [view, setView] = useState<View>({ name: 'home' });
  const [books, setBooks] = useState<SodamBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { online, enqueue, flush, pendingCount, flushFailed, bindBook, refreshPending } =
    useSodamOffline(api);
  const joinFromLinkTried = useRef(false);

  const refreshBooks = useCallback(async () => {
    try {
      const list = await api.listBooks(mode === 'mock' ? [] : knownBookCodes());
      setBooks(list);
      for (const b of list) rememberBook(b.id, b.inviteCode);
      setError(null);
    } catch (e) {
      // Mất mạng: banner offline đã nói rõ; không chồng thêm banner lỗi thô.
      if (navigator.onLine) setError(friendlyError(e, 'Lỗi tải sổ'));
    }
  }, [api, mode]);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  // Share link (?code=XXXX): mở link là vào thẳng sổ.
  useEffect(() => {
    if (joinFromLinkTried.current) return;
    joinFromLinkTried.current = true;
    const code = new URLSearchParams(window.location.search).get('code')?.trim();
    if (!code) return;
    void (async () => {
      try {
        const book = await api.joinBook(code);
        rememberBook(book.id, book.inviteCode);
        await refreshBooks();
        setView({ name: 'dashboard', bookId: book.id });
      } catch {
        setError('Mã sổ trong liên kết không đúng hoặc sổ đã bị xoá.');
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.toString());
      }
    })();
  }, [api, refreshBooks]);

  const bookId = view.name === 'home' ? null : view.bookId;
  const activeBook = books.find((b) => b.id === bookId) ?? null;
  const showBookNav = view.name !== 'home' && Boolean(bookId);

  useEffect(() => {
    if (bookId) bindBook(bookId);
  }, [bookId, bindBook]);

  useEffect(() => {
    if (online && bookId) void flush(bookId);
  }, [online, bookId, flush]);

  const onNav = (id: SodamNavId) => {
    if (!bookId || id === 'home') {
      setView({ name: 'home' });
      return;
    }
    if (id === 'overview') setView({ name: 'dashboard', bookId });
    if (id === 'returns') setView({ name: 'returns', bookId });
    if (id === 'people') setView({ name: 'people', bookId });
    if (id === 'tree') setView({ name: 'tree', bookId });
  };

  const outboxChip =
    bookId && pendingCount > 0 ? (
      <OutboxChip
        count={pendingCount}
        failed={flushFailed}
        onRetry={() => void flush(bookId).then(() => refreshPending())}
      />
    ) : null;

  return (
    <SodamShell
      title={view.name === 'home' ? 'Sổ Đám' : (activeBook?.name ?? 'Sổ Đám')}
      inviteCode={showBookNav ? activeBook?.inviteCode : undefined}
      online={online}
      error={error}
      activeNav={navFromView(view)}
      onNav={onNav}
      showBookNav={showBookNav}
      onBackHome={() => setView({ name: 'home' })}
    >
      {view.name === 'home' ? (
        <HomeView
          api={api}
          books={books}
          online={online}
          onCreate={async (name) => {
            try {
              const book = await api.createBook(name);
              await refreshBooks();
              setView({ name: 'dashboard', bookId: book.id });
              return null;
            } catch (e) {
              if (!navigator.onLine) {
                return 'Chưa có mạng — chưa tạo được sổ. Tên sổ đã được giữ lại, bấm Thử lại khi có mạng.';
              }
              return friendlyError(e, 'Chưa tạo được sổ — thử lại sau ít phút.');
            }
          }}
          onJoin={async (code) => {
            try {
              const book = await api.joinBook(code.trim());
              await refreshBooks();
              setView({ name: 'dashboard', bookId: book.id });
              return null;
            } catch {
              return 'Không tìm thấy sổ với mã này — kiểm tra lại mã hoặc mở link chia sẻ là vào thẳng.';
            }
          }}
          onOpen={(id) => setView({ name: 'dashboard', bookId: id })}
        />
      ) : null}

      {view.name === 'dashboard' ? (
        <DashboardView
          api={api}
          bookId={view.bookId}
          online={online}
          enqueue={enqueue}
          outboxChip={outboxChip}
          onOpenEvent={(eventId) => setView({ name: 'event', bookId: view.bookId, eventId })}
          onReturns={() => setView({ name: 'returns', bookId: view.bookId })}
          onError={setError}
        />
      ) : null}

      {view.name === 'event' ? (
        <EventView
          api={api}
          bookId={view.bookId}
          eventId={view.eventId}
          online={online}
          enqueue={enqueue}
          outboxChip={outboxChip}
          onBack={() => setView({ name: 'dashboard', bookId: view.bookId })}
          onError={setError}
        />
      ) : null}

      {view.name === 'returns' ? (
        <ReturnsView
          api={api}
          bookId={view.bookId}
          bookName={activeBook?.name}
          onGoDashboard={() => setView({ name: 'dashboard', bookId: view.bookId })}
          onError={setError}
        />
      ) : null}

      {view.name === 'tree' ? (
        <TreeView api={api} bookId={view.bookId} bookName={activeBook?.name} onError={setError} />
      ) : null}

      {view.name === 'people' ? (
        <PeopleView api={api} bookId={view.bookId} bookName={activeBook?.name} onError={setError} />
      ) : null}
    </SodamShell>
  );
}

function HomeView({
  api,
  books,
  online,
  onCreate,
  onJoin,
  onOpen,
}: {
  api: SodamApi;
  books: SodamBook[];
  online: boolean;
  onCreate: (name: string) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Record<string, number>>({});

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

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[10px]"
          />
          <h1 className="text-[28px] leading-[34px] font-bold tracking-tight">Sổ Đám</h1>
        </div>
        <p className="mt-1.5 text-[15px] text-muted">Sổ ghi tiền mừng của nhà mình.</p>

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
                placeholder="VD: Sổ cưới 2026, Sổ giỗ bà"
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
              if (busy || code.trim().length < 3) return;
              setBusy(true);
              void onJoin(code)
                .then((err) => setJoinError(err))
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Mã mời" error={joinError}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
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

        <section aria-label="Sổ của bạn" className="mt-8">
          <h2 className="text-[17px] font-semibold">
            Sổ của bạn{' '}
            <span className="font-normal text-muted">
              ({books.length} {books.length === 1 ? 'sổ' : 'sổ'})
            </span>
          </h2>
          {books.length === 0 ? (
            <div className="mt-2 rounded-xl border border-line bg-card">
              <EmptyLedger
                title="Chưa có sổ nào"
                body="Tạo sổ đầu tiên ở trên để bắt đầu ghi lễ cho nhà mình."
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-card">
              {books.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(b.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                  >
                    <BookAvatar name={b.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {b.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted">
                        {formatInviteCode(b.inviteCode)}
                      </span>
                    </span>
                    {totals[b.id] != null ? (
                      <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                        {money(totals[b.id]!)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SeasonStrip />
      </div>

      <div className="mt-10">
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
      <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm bg-lacquer" />
      Còn <span className="font-mono font-semibold text-ink">{tet.days} ngày</span> tới Tết Nguyên
      đán ({fmt})
    </p>
  );
}

function DashboardView({
  api,
  bookId,
  online,
  enqueue,
  outboxChip,
  onOpenEvent,
  onReturns,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  online: boolean;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  outboxChip: React.ReactNode;
  onOpenEvent: (id: string) => void;
  onReturns: () => void;
  onError: (m: string | null) => void;
}) {
  const [dash, setDash] = useState<SodamDashboard | null>(null);
  const [events, setEvents] = useState<SodamEvent[]>([]);
  const [pending, setPending] = useState<SodamReturnItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [entryEvent, setEntryEvent] = useState<SodamEvent | null>(null);

  const reload = useCallback(async () => {
    try {
      const [d, evs, rets] = await Promise.all([
        api.dashboard(bookId),
        api.listEvents(bookId),
        api.listReturns(bookId, 'OPEN'),
      ]);
      setDash(d);
      setEvents(evs);
      setPending(rets);
      onError(null);
    } catch (e) {
      onError(friendlyError(e, 'Lỗi tải sổ'));
    }
  }, [api, bookId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!dash) {
    return <p className="text-sm text-muted">Đang tải sổ…</p>;
  }

  const t = dash.totals;
  const ghiKhoanTarget = dash.openEvent ?? events[0] ?? null;

  return (
    <div className="pb-24">
      <h1 className="sr-only">{dash.book.name}</h1>
      <KpiBand
        items={[
          { label: 'Còn giữ', value: money(t.receivedVnd) },
          { label: 'Đã nhận', value: money(t.receivedGrossVnd ?? t.receivedVnd) },
          { label: 'Đã trả / đi', value: money(t.givenVnd) },
          {
            label: 'Cần trả lễ',
            value: money(t.pendingReturnVnd ?? 0),
            sub: `${dash.openReturnCount} khách`,
          },
        ]}
      />
      <p className="mt-2.5 text-sm text-muted">
        Đã nhận{' '}
        <span className="font-mono font-medium text-ink">{money(t.receivedGrossVnd ?? 0)}</span>
        {' − đã trả '}
        <span className="font-mono font-medium text-ink">{money(t.settledVnd ?? 0)}</span>
        {' = còn giữ '}
        <span className="font-mono font-medium text-ink">{money(t.receivedVnd)}</span>
        {(t.overGivenVnd ?? 0) > 0 ? (
          <>
            {' · đi nhiều hơn '}
            <span className="font-mono font-medium text-lacquer">{money(t.overGivenVnd!)}</span>
          </>
        ) : null}
      </p>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Đám</h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Btn
              variant="ghost"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Thêm tuỳ chọn cho sổ"
            >
              ⋯
            </Btn>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-lift)]">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  onClick={() => {
                    setMenuOpen(false);
                    void (async () => {
                      try {
                        const csv = await api.exportCsv(bookId);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sodam-export.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        onError(friendlyError(e, 'Xuất CSV lỗi'));
                      }
                    })();
                  }}
                >
                  Xuất CSV
                </button>
                <label className="flex min-h-11 w-full cursor-pointer items-center rounded-lg px-3 text-sm hover:bg-indigo-50">
                  Nhập CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setMenuOpen(false);
                      if (!file) return;
                      void file.text().then(async (csv) => {
                        try {
                          await api.importCsv(bookId, csv);
                          await reload();
                        } catch (err) {
                          onError(friendlyError(err, 'Nhập CSV lỗi'));
                        }
                      });
                    }}
                  />
                </label>
                {dash.openEvent ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    onClick={() => {
                      setMenuOpen(false);
                      void api
                        .closeEvent(bookId, dash.openEvent!.id)
                        .then(reload)
                        .catch((err: Error) => onError(friendlyError(err, 'Đóng đám lỗi')));
                    }}
                  >
                    Đóng đám đang ghi
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <Btn variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Tạo đám
          </Btn>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-card">
          <EmptyLedger
            title="Chưa có đám nào"
            body="Tạo đám đầu tiên để bắt đầu ghi khoản cho nhà mình."
            action={
              <Btn onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> Tạo đám
              </Btn>
            }
          />
        </div>
      ) : (
        <ul className="mt-3 max-h-[46dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
          {events.map((e) => {
            const dates = eventDateLabels(e.occurredOn);
            const lex = lexiconForKind(e.kind);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(e.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                >
                  <BookAvatar name={e.title} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {e.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {kindLabel(e.kind)} · {e.role === 'HOSTED' ? 'Nhận lễ' : 'Đi đám'}
                      {dates ? ` · ${dates.solar}` : ''} · {e.entryCount ?? 0}{' '}
                      {lex.personLabel.toLowerCase()}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                    {money(e.totalAmountVnd ?? 0)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pending.length > 0 ? (
        <section aria-label="Chờ trả lễ" className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Chờ trả lễ</h2>
            <Btn variant="ghost" onClick={onReturns}>
              Xem hết
            </Btn>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-card">
            {pending.slice(0, 5).map((r) => (
              <li key={r.id}>
                <LedgerRow
                  name={r.personName ?? r.personId}
                  personId={r.personId}
                  amountLabel={money(r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0)}
                  meta={r.fromEventTitle ?? undefined}
                  trailing={<StatusPill status="OPEN" />}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <StickyActionBar totalLabel="Còn giữ" totalValue={money(t.receivedVnd)} chip={outboxChip}>
        <Btn onClick={() => (ghiKhoanTarget ? setEntryEvent(ghiKhoanTarget) : setCreateOpen(true))}>
          <Plus className="size-4" /> Ghi khoản
        </Btn>
      </StickyActionBar>

      <CreateEventSheet
        open={createOpen}
        api={api}
        bookId={bookId}
        onClose={() => setCreateOpen(false)}
        onCreated={(ev, ghiNgay) => {
          setCreateOpen(false);
          void reload();
          if (ghiNgay) setEntryEvent(ev);
          else onOpenEvent(ev.id);
        }}
        onError={onError}
      />
      {entryEvent ? (
        <EntrySheet
          api={api}
          bookId={bookId}
          event={entryEvent}
          online={online}
          enqueue={enqueue}
          onClose={() => setEntryEvent(null)}
          onSaved={() => void reload()}
        />
      ) : null}
    </div>
  );
}

function CreateEventSheet({
  open,
  api,
  bookId,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  api: SodamApi;
  bookId: string;
  onClose: () => void;
  onCreated: (event: SodamEvent, ghiNgay: boolean) => void;
  onError: (m: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<SodamEventKind>('CUOI');
  const [role, setRole] = useState<SodamEventRole>('HOSTED');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const dates = eventDateLabels(date);

  const create = async (ghiNgay: boolean) => {
    setBusy(true);
    try {
      const ev = await api.createEvent(bookId, {
        title: title.trim() || kindLabel(kind),
        kind,
        role,
        occurredOn: date || undefined,
      });
      setTitle('');
      onCreated(ev, ghiNgay);
    } catch (e) {
      onError(friendlyError(e, 'Tạo đám lỗi'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Tạo đám" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Tên đám">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`VD: ${kindLabel(kind)} nhà mình`}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">Loại đám</p>
          <EventKindPicker value={kind} onChange={setKind} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Vai trò</p>
          <SegmentedTabs
            ariaLabel="Vai trò của nhà mình"
            value={role}
            onChange={(id) => setRole(id as SodamEventRole)}
            options={[
              { id: 'HOSTED', label: 'Nhận lễ' },
              { id: 'ATTENDED', label: 'Đi đám' },
            ]}
          />
        </div>
        <Field label="Ngày (dương lịch)">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {dates?.lunar ? (
          <p className="-mt-2 text-sm text-muted">
            Ngày âm: <span className="font-medium text-gold-ink">{dates.lunar}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted">Ghi ngày dương — app tự hiện ngày âm.</p>
        {kind === 'GIO' ? (
          <p className="rounded-[10px] bg-gold-soft px-3 py-2 text-sm font-medium text-gold-ink">
            Giỗ tính theo ngày âm — app hiện ngày âm để đối chiếu hằng năm.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Btn className="flex-1" disabled={busy} onClick={() => void create(true)}>
            Tạo đám & ghi ngay
          </Btn>
          <Btn
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => void create(false)}
          >
            Tạo đám
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Sheet ghi khoản — 2 mode [Gõ tay | Giọng nói]. Tiền để trống mặc định;
 * trống khi lưu = lỗi tại trường + focus. Có dòng xem lại bắt buộc trước
 * khi lưu. Offline: khoản vào hàng chờ trên máy (outbox thật).
 */
function EntrySheet({
  api,
  bookId,
  event,
  online,
  enqueue,
  onClose,
  onSaved,
}: {
  api: SodamApi;
  bookId: string;
  event: SodamEvent;
  online: boolean;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const lex = lexiconForKind(event.kind);
  const [mode, setMode] = useState('manual');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [people, setPeople] = useState<SodamPerson[]>([]);
  const [queuedNote, setQueuedNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Giọng nói
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recogRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    void api
      .listPeople(bookId)
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [api, bookId]);

  useEffect(
    () => () => {
      try {
        recogRef.current?.stop();
      } catch {
        // Đã dừng rồi — bỏ qua.
      }
    },
    [],
  );

  const amountNum = Number(amount.replace(/\D/g, '')) || 0;
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    return people.filter((p) => !q || p.displayName.toLowerCase().includes(q)).slice(0, 6);
  }, [people, name]);

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleUtterance = async (text: string) => {
    setTranscript(text);
    try {
      const parsed: SodamParseResult = await api.parseUtterance(bookId, text);
      if (parsed.name) setName(parsed.name);
      if (parsed.amountVnd != null) setAmount(String(parsed.amountVnd));
      setVoiceNote(parsed.speakBack);
      speak(parsed.speakBack);
    } catch (e) {
      setVoiceNote(friendlyError(e, 'Chưa nghe rõ — đọc lại hoặc chuyển sang Gõ tay.'));
    }
  };

  const toggleListen = () => {
    if (listening) {
      try {
        recogRef.current?.stop();
      } catch {
        // bỏ qua
      }
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    type SpeechRec = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult:
        | ((ev: {
            resultIndex: number;
            results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void)
        | null;
      onend: (() => void) | null;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceNote('Trình duyệt này không hỗ trợ ghi bằng giọng nói — dùng Gõ tay vẫn được.');
      return;
    }
    const recog = new SR();
    recog.lang = 'vi-VN';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (ev) => {
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) void handleUtterance(finalText.trim());
    };
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  };

  const save = async () => {
    let ok = true;
    if (!name.trim()) {
      setNameError(`Chưa nhập tên — gõ tên hoặc chọn một người bên dưới.`);
      ok = false;
    } else setNameError(null);
    if (amountNum <= 0) {
      setAmountError('Chưa nhập số tiền — chạm một mức bên dưới hoặc gõ số tiền.');
      ok = false;
    } else setAmountError(null);
    if (!ok) {
      if (!name.trim()) nameRef.current?.focus();
      else amountRef.current?.focus();
      return;
    }
    const source = mode === 'voice' ? 'VOICE' : 'MANUAL';
    setBusy(true);
    try {
      if (!online) {
        enqueue(bookId, 'createEntry', {
          eventId: event.id,
          personName: name.trim(),
          amountVnd: amountNum,
          source,
        });
        setQueuedNote(true);
        onSaved();
        return;
      }
      await api.createEntry(bookId, event.id, {
        personName: name.trim(),
        amountVnd: amountNum,
        source,
        rawText: source === 'VOICE' ? transcript || undefined : undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setAmountError(friendlyError(e, 'Chưa lưu được khoản — thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open title={`Ghi khoản — ${event.title}`} onClose={onClose}>
      {queuedNote ? (
        <div className="space-y-4">
          <p role="status" className="rounded-[10px] bg-indigo-50 px-3 py-3 text-sm font-medium">
            Đã lưu vào hàng chờ trên máy này — sẽ tự gửi khi có mạng.
          </p>
          <Btn className="w-full" onClick={onClose}>
            Xong
          </Btn>
        </div>
      ) : (
        <div className="space-y-4">
          <SegmentedTabs
            ariaLabel="Cách ghi khoản"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'manual', label: 'Gõ tay' },
              { id: 'voice', label: 'Giọng nói' },
            ]}
          />

          {mode === 'voice' ? (
            <div className="space-y-3">
              <Btn
                className="min-h-12 w-full"
                variant={listening ? 'danger' : 'primary'}
                onClick={toggleListen}
              >
                <Mic className="size-4" />
                {listening ? 'Dừng nghe' : 'Bấm để nói'}
              </Btn>
              <p className="text-sm text-muted">
                Ghi miệng trước, sửa sau. Tiền chỉ lưu khi bạn xác nhận Lưu.
              </p>
              {transcript ? (
                <p className="rounded-[10px] border border-line bg-paper px-3 py-2.5 text-sm">
                  <span className="text-xs font-medium text-muted">Vừa nghe: </span>
                  {transcript}
                </p>
              ) : null}
              {voiceNote ? (
                <p role="status" className="text-sm font-medium text-indigo-700">
                  {voiceNote}
                </p>
              ) : null}
            </div>
          ) : null}

          <Field label={lex.nameFieldLabel} error={nameError}>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ tên"
              autoComplete="off"
            />
          </Field>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Người đã có trong sổ">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setName(p.displayName)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-card px-3 text-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {p.displayName}
                </button>
              ))}
            </div>
          ) : null}

          <Field label={`Số ${lex.entryNoun}`} error={amountError}>
            <Input
              ref={amountRef}
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0₫"
            />
          </Field>
          <QuickAmounts onPick={(v) => setAmount(String(v))} />

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 text-sm text-muted" aria-live="polite">
              {name.trim() && amountNum > 0 ? (
                <>
                  Sẽ ghi: <span className="font-medium text-ink">{name.trim()}</span> —{' '}
                  <span className="font-mono font-semibold text-ink">{money(amountNum)}</span>
                </>
              ) : (
                'Sẽ ghi: …'
              )}
            </p>
            <Btn disabled={busy} onClick={() => void save()} className="shrink-0">
              Lưu khoản
            </Btn>
          </div>
          {!online ? (
            <p className="text-sm text-muted">
              Đang offline — khoản sẽ lưu vào hàng chờ trên máy này và tự gửi khi có mạng.
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function EventView({
  api,
  bookId,
  eventId,
  online,
  enqueue,
  outboxChip,
  onBack,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  eventId: string;
  online: boolean;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  outboxChip: React.ReactNode;
  onBack: () => void;
  onError: (m: string | null) => void;
}) {
  const [event, setEvent] = useState<(SodamEvent & { entries: SodamEntry[] }) | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setEvent(await api.getEvent(bookId, eventId));
    } catch (e) {
      onError(friendlyError(e, 'Lỗi tải đám'));
    }
  }, [api, bookId, eventId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!event) return <p className="text-sm text-muted">Đang tải đám…</p>;

  const lex = lexiconForKind(event.kind);
  const isHosted = event.role === 'HOSTED';
  const gross = event.totalAmountVnd ?? 0;
  const settled = event.settledVnd ?? 0;
  const net = event.netTotalVnd ?? Math.max(0, gross - settled);
  const dates = eventDateLabels(event.occurredOn);

  return (
    <div className="pb-24">
      <Btn variant="ghost" onClick={onBack} className="-ml-3">
        ← Đám
      </Btn>
      <h1 className="mt-1 truncate text-[28px] leading-[34px] font-bold tracking-tight">
        {event.title}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
        <span>
          {kindLabel(event.kind)} · {isHosted ? 'Nhận lễ' : 'Đi đám'} · {event.entryCount ?? 0}{' '}
          {lex.personLabel.toLowerCase()}
        </span>
        {dates ? <span>· {dates.solar}</span> : null}
        {dates?.lunar ? (
          <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold-ink">
            {dates.lunar}
          </span>
        ) : null}
      </p>

      <div className="mt-4 flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-card">
        {(isHosted
          ? [
              { label: lex.totalLabel, value: gross },
              { label: 'Còn giữ', value: net },
              { label: 'Đã trả', value: settled },
            ]
          : [{ label: 'Tổng đã đưa', value: gross }]
        ).map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-3.5 py-3">
            <p className="truncate text-xs text-muted">{cell.label}</p>
            <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tabular-nums">
              {money(cell.value)}
            </p>
          </div>
        ))}
      </div>

      <section aria-label="Sổ khoản" className="mt-5">
        <div
          className="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-3.5 pb-2 text-sm font-medium text-muted sm:grid-cols-[1fr_8rem_7rem_8rem_2rem]"
          aria-hidden
        >
          <span>Người</span>
          <span className="text-right">Số tiền</span>
          <span className="hidden sm:block">Nguồn</span>
          <span className="hidden sm:block">Trả lễ</span>
          <span className="hidden sm:block" />
        </div>
        {event.entries.length === 0 ? (
          <div className="mt-3 rounded-xl border border-line bg-card">
            <EmptyLedger
              title={lex.emptyTitle}
              body={lex.emptyBody}
              action={
                <Btn onClick={() => setEntryOpen(true)}>
                  <Plus className="size-4" /> Ghi khoản
                </Btn>
              }
            />
          </div>
        ) : (
          <ul className="max-h-[52dvh] divide-y divide-line overflow-y-auto rounded-b-xl border border-t-0 border-line bg-card">
            {event.entries.map((e) => (
              <li key={e.id}>
                <LedgerRow
                  name={e.personName}
                  personId={e.personId ?? undefined}
                  amountLabel={money(e.amountVnd)}
                  meta={`${sourceLabel(e.source)} · ${new Date(e.createdAt).toLocaleDateString('vi-VN')}`}
                  trailing={
                    isHosted && e.returnItem ? (
                      e.returnItem.status === 'DONE' ? (
                        (e.returnItem.overGivenVnd ?? 0) > 0 ? (
                          <StatusPill status="OVER" />
                        ) : (
                          <StatusPill status="DONE" />
                        )
                      ) : e.returnItem.status === 'SKIPPED' ? (
                        <StatusPill status="SKIPPED" />
                      ) : (
                        <StatusPill status="OPEN" />
                      )
                    ) : undefined
                  }
                  onClick={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
                />
                {expandedId === e.id ? (
                  <EntryExpand
                    api={api}
                    bookId={bookId}
                    event={event}
                    entry={e}
                    onDone={() => void reload()}
                    onError={onError}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <StickyActionBar totalLabel={lex.totalLabel} totalValue={money(gross)} chip={outboxChip}>
        <Btn onClick={() => setEntryOpen(true)}>
          <Plus className="size-4" /> Ghi khoản
        </Btn>
      </StickyActionBar>

      {entryOpen ? (
        <EntrySheet
          api={api}
          bookId={bookId}
          event={event}
          online={online}
          enqueue={enqueue}
          onClose={() => setEntryOpen(false)}
          onSaved={() => void reload()}
        />
      ) : null}
    </div>
  );
}

/** Phần mở rộng trong hàng sổ: trả lễ (có xác nhận nêu hệ quả) + sửa + xoá khoản. */
function EntryExpand({
  api,
  bookId,
  event,
  entry,
  onDone,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  event: SodamEvent;
  entry: SodamEntry;
  onDone: () => void;
  onError: (m: string | null) => void;
}) {
  const lex = lexiconForKind(event.kind);
  const ret = entry.returnItem;
  const received = ret?.receivedAmountVnd ?? entry.amountVnd;
  const [pay, setPay] = useState(String(received));
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(entry.personName);
  const [editAmount, setEditAmount] = useState(String(entry.amountVnd));
  const [editNote, setEditNote] = useState(entry.note ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payNum = Number(pay.replace(/\D/g, '')) || 0;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      onError(friendlyError(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-row border-t border-line bg-paper px-3.5 py-3.5">
      {event.role === 'HOSTED' && ret ? (
        <div className="mb-4">
          {ret.status === 'OPEN' ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Số tiền trả lễ">
                  <Input
                    inputMode="numeric"
                    value={formatAmountInput(pay)}
                    onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))}
                    aria-label={`Số tiền trả lễ cho ${entry.personName}`}
                  />
                </Field>
                {!confirming ? (
                  <Btn disabled={payNum <= 0} onClick={() => setConfirming(true)}>
                    Trả lễ
                  </Btn>
                ) : null}
              </div>
              <div className="mt-2">
                <QuickAmounts onPick={(v) => setPay(String(v))} />
              </div>
              {confirming ? (
                <div
                  role="group"
                  aria-label="Xác nhận trả lễ"
                  className="mt-3 rounded-[10px] border border-line-strong bg-card px-3 py-3"
                >
                  <p className="text-sm">
                    Trả <span className="font-mono font-semibold">{money(payNum)}</span> cho{' '}
                    {entry.personName}? Khoản này sẽ trừ đúng{' '}
                    <span className="font-mono font-semibold">{money(received)}</span>{' '}
                    {lex.entryNoun} khỏi số còn giữ của sổ.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Btn
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api.markReturn(bookId, ret.id, { status: 'DONE', amountVnd: payNum }),
                          'Chưa ghi được trả lễ',
                        )
                      }
                    >
                      Xác nhận trả
                    </Btn>
                    <Btn variant="secondary" onClick={() => setConfirming(false)}>
                      Huỷ
                    </Btn>
                  </div>
                </div>
              ) : null}
            </>
          ) : ret.status === 'DONE' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">
                Đã trả{' '}
                <span className="font-mono font-semibold text-ink">
                  {money(ret.returnedAmountVnd ?? received)}
                </span>
                {(ret.overGivenVnd ?? 0) > 0 ? (
                  <>
                    {' '}
                    · đi nhiều hơn{' '}
                    <span className="font-mono font-semibold text-lacquer">
                      {money(ret.overGivenVnd!)}
                    </span>
                  </>
                ) : null}
              </p>
              <Btn
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api.markReturn(bookId, ret.id, { status: 'OPEN' }),
                    'Chưa hoàn tác được',
                  )
                }
              >
                <Undo2 className="size-4" /> Hoàn tác
              </Btn>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">Đã bỏ qua trả lễ cho khoản này.</p>
              <Btn
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api.markReturn(bookId, ret.id, { status: 'OPEN' }),
                    'Chưa mở lại được',
                  )
                }
              >
                <Undo2 className="size-4" /> Mở lại
              </Btn>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto] sm:items-end">
        <Field label="Tên">
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </Field>
        <Field label="Số tiền">
          <Input
            inputMode="numeric"
            value={formatAmountInput(editAmount)}
            onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Ghi chú">
          <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
        </Field>
        <Btn
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const amt = Number(editAmount.replace(/\D/g, '')) || 0;
            if (!editName.trim()) {
              setEditError('Tên không được để trống.');
              return;
            }
            if (amt <= 0) {
              setEditError('Số tiền phải lớn hơn 0.');
              return;
            }
            setEditError(null);
            void run(
              () =>
                api.updateEntry(bookId, event.id, entry.id, {
                  personName: editName.trim(),
                  amountVnd: amt,
                  note: editNote,
                }),
              'Chưa sửa được khoản',
            );
          }}
        >
          <Pencil className="size-4" /> Lưu sửa
        </Btn>
      </div>
      {editError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-lacquer">
          {editError}
        </p>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        {!confirmDelete ? (
          <Btn
            variant="ghost"
            className="text-lacquer hover:bg-lacquer/5"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Xoá khoản
          </Btn>
        ) : (
          <div
            role="group"
            aria-label="Xác nhận xoá khoản"
            className="rounded-[10px] border border-lacquer bg-card px-3 py-3"
          >
            <p className="text-sm">
              Xoá khoản {lex.entryNoun}{' '}
              <span className="font-mono font-semibold">{money(entry.amountVnd)}</span> của{' '}
              {entry.personName}? Khoản này sẽ mất khỏi sổ và các tổng sẽ tính lại ngay.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Btn
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void run(() => api.deleteEntry(bookId, event.id, entry.id), 'Chưa xoá được khoản')
                }
              >
                Xoá hẳn
              </Btn>
              <Btn variant="secondary" onClick={() => setConfirmDelete(false)}>
                Huỷ
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnsView({
  api,
  bookId,
  bookName,
  onGoDashboard,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  bookName?: string;
  onGoDashboard: () => void;
  onError: (m: string | null) => void;
}) {
  const [all, setAll] = useState<SodamReturnItem[] | null>(null);
  const [filter, setFilter] = useState('OPEN');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAll(await api.listReturns(bookId));
    } catch (e) {
      onError(friendlyError(e, 'Lỗi tải danh sách trả lễ'));
    }
  }, [api, bookId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!all) return <p className="text-sm text-muted">Đang tải danh sách trả lễ…</p>;

  const receivedOf = (r: SodamReturnItem) => r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0;
  const open = all.filter((r) => r.status === 'OPEN');
  const done = all.filter((r) => r.status === 'DONE');
  const skipped = all.filter((r) => r.status === 'SKIPPED');
  const over = done.filter((r) => (r.overGivenVnd ?? 0) > 0);
  const shown = filter === 'OPEN' ? open : filter === 'OVER' ? over : [...done, ...skipped];

  return (
    <div>
      <h1 className="sr-only">Trả lễ{bookName ? ` — ${bookName}` : ''}</h1>
      <div className="flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-card">
        {[
          { label: 'Chờ trả', value: open.reduce((s, r) => s + receivedOf(r), 0) },
          {
            label: 'Đã trả',
            value: done.reduce((s, r) => s + (r.returnedAmountVnd ?? r.doneAmountVnd ?? 0), 0),
          },
          { label: 'Quá tay', value: over.reduce((s, r) => s + (r.overGivenVnd ?? 0), 0) },
        ].map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-3.5 py-3">
            <p className="text-xs text-muted">{cell.label}</p>
            <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tabular-nums">
              {money(cell.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SegmentedTabs
          ariaLabel="Lọc khoản trả lễ"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'OPEN', label: `Chờ trả (${open.length})` },
            { id: 'DONE', label: 'Đã trả' },
            { id: 'OVER', label: 'Quá tay' },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-card">
          <EmptyLedger
            title={
              filter === 'OPEN'
                ? 'Không còn khoản chờ trả'
                : filter === 'OVER'
                  ? 'Chưa có khoản quá tay'
                  : 'Chưa có khoản đã trả'
            }
            body={
              filter === 'OPEN'
                ? 'Khi có khách mừng trong đám nhà mình tổ chức, khoản cần trả sẽ hiện ở đây.'
                : 'Các khoản đã xử lý sẽ hiện ở đây để nhà mình đối chiếu.'
            }
            action={
              <Btn variant="secondary" onClick={onGoDashboard}>
                Về mục Đám
              </Btn>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 max-h-[56dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
          {shown.map((r) => {
            const isOver = (r.overGivenVnd ?? 0) > 0;
            return (
              <li key={r.id}>
                <LedgerRow
                  name={r.personName ?? r.personId}
                  personId={r.personId}
                  amountLabel={money(receivedOf(r))}
                  meta={r.fromEventTitle ?? undefined}
                  trailing={
                    r.status === 'OPEN' ? (
                      <StatusPill status="OPEN" />
                    ) : r.status === 'SKIPPED' ? (
                      <StatusPill status="SKIPPED" />
                    ) : isOver ? (
                      <StatusPill status="OVER" />
                    ) : (
                      <StatusPill status="DONE" />
                    )
                  }
                  onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                />
                {expandedId === r.id ? (
                  <ReturnExpand
                    api={api}
                    bookId={bookId}
                    item={r}
                    onDone={() => void reload()}
                    onError={onError}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReturnExpand({
  api,
  bookId,
  item,
  onDone,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  item: SodamReturnItem;
  onDone: () => void;
  onError: (m: string | null) => void;
}) {
  const received = item.receivedAmountVnd ?? item.suggestedAmountVnd ?? 0;
  const [pay, setPay] = useState(String(received));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const payNum = Number(pay.replace(/\D/g, '')) || 0;
  const name = item.personName ?? item.personId;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      onError(friendlyError(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  if (item.status !== 'OPEN') {
    return (
      <div className="animate-row flex flex-wrap items-center gap-2 border-t border-line bg-paper px-3.5 py-3">
        <p className="text-sm text-muted">
          {item.status === 'DONE' ? (
            <>
              Đã trả{' '}
              <span className="font-mono font-semibold text-ink">
                {money(item.returnedAmountVnd ?? item.doneAmountVnd ?? received)}
              </span>
              {(item.overGivenVnd ?? 0) > 0 ? (
                <>
                  {' '}
                  · đi nhiều hơn{' '}
                  <span className="font-mono font-semibold text-lacquer">
                    {money(item.overGivenVnd!)}
                  </span>{' '}
                  so với số đã nhận
                </>
              ) : null}
            </>
          ) : (
            'Đã bỏ qua khoản trả lễ này.'
          )}
        </p>
        <Btn
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(
              () => api.markReturn(bookId, item.id, { status: 'OPEN' }),
              'Chưa hoàn tác được',
            )
          }
        >
          <Undo2 className="size-4" /> Hoàn tác
        </Btn>
      </div>
    );
  }

  return (
    <div className="animate-row border-t border-line bg-paper px-3.5 py-3.5">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Số tiền mình trả">
          <Input
            inputMode="numeric"
            value={formatAmountInput(pay)}
            onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))}
            aria-label={`Số tiền trả lễ cho ${name}`}
          />
        </Field>
        {!confirming ? (
          <>
            <Btn disabled={payNum <= 0} onClick={() => setConfirming(true)}>
              Đã trả
            </Btn>
            <Btn
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.markReturn(bookId, item.id, { status: 'SKIPPED' }),
                  'Chưa bỏ qua được',
                )
              }
            >
              Bỏ qua
            </Btn>
          </>
        ) : null}
      </div>
      <div className="mt-2">
        <QuickAmounts onPick={(v) => setPay(String(v))} />
      </div>
      {confirming ? (
        <div
          role="group"
          aria-label="Xác nhận trả lễ"
          className="mt-3 rounded-[10px] border border-line-strong bg-card px-3 py-3"
        >
          <p className="text-sm">
            Trả <span className="font-mono font-semibold">{money(payNum)}</span> cho {name}? Khoản
            này sẽ trừ đúng <span className="font-mono font-semibold">{money(received)}</span> tiền
            đã nhận khỏi số còn giữ của sổ.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Btn
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.markReturn(bookId, item.id, { status: 'DONE', amountVnd: payNum }),
                  'Chưa ghi được trả lễ',
                )
              }
            >
              Xác nhận trả
            </Btn>
            <Btn variant="secondary" onClick={() => setConfirming(false)}>
              Huỷ
            </Btn>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Họ đã mừng <span className="font-mono font-medium text-ink">{money(received)}</span> — số
          trả mặc định bằng số đã nhận, sửa được trước khi xác nhận.
        </p>
      )}
    </div>
  );
}

type PersonAggregate = {
  person: SodamPerson;
  received: number;
  given: number;
  history: Array<{ entry: SodamEntry; eventTitle: string; role: SodamEventRole }>;
};

function PeopleView({
  api,
  bookId,
  bookName,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  bookName?: string;
  onError: (m: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PersonAggregate[] | null>(null);
  const [selected, setSelected] = useState<PersonAggregate | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [people, events] = await Promise.all([
          api.listPeople(bookId),
          api.listEvents(bookId),
        ]);
        const details = await Promise.all(
          events.map((e) => api.getEvent(bookId, e.id).catch(() => null)),
        );
        const map = new Map<string, PersonAggregate>();
        for (const p of people) {
          map.set(p.id, { person: p, received: 0, given: 0, history: [] });
        }
        for (const detail of details) {
          if (!detail) continue;
          for (const entry of detail.entries) {
            const key = entry.personId ?? entry.personName;
            let agg = map.get(key);
            if (!agg) {
              agg = {
                person: {
                  id: key,
                  bookId,
                  displayName: entry.personName,
                  note: '',
                  createdAt: entry.createdAt,
                  updatedAt: entry.updatedAt,
                },
                received: 0,
                given: 0,
                history: [],
              };
              map.set(key, agg);
            }
            if (detail.role === 'HOSTED') agg.received += entry.amountVnd;
            else agg.given += entry.amountVnd;
            agg.history.push({ entry, eventTitle: detail.title, role: detail.role });
          }
        }
        setRows(
          [...map.values()].sort((a, b) =>
            a.person.displayName.localeCompare(b.person.displayName, 'vi'),
          ),
        );
      } catch (e) {
        onError(friendlyError(e, 'Lỗi tải danh sách người'));
        setRows([]);
      }
    })();
  }, [api, bookId, onError]);

  const shown = (rows ?? []).filter((r) =>
    r.person.displayName.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div>
      <h1 className="sr-only">Người{bookName ? ` — ${bookName}` : ''}</h1>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          aria-label="Tìm người"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nhập tên…"
        />
      </div>

      {rows === null ? (
        <p className="mt-4 text-sm text-muted">Đang tải danh sách người…</p>
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-card">
          <EmptyLedger
            title={q.trim() ? 'Không thấy người này' : 'Chưa có ai trong sổ'}
            body={
              q.trim()
                ? 'Thử gõ tên khác, hoặc người này chưa được ghi khoản nào.'
                : 'Ghi khoản đầu tiên ở mục Đám — người được ghi sẽ hiện ở đây.'
            }
          />
        </div>
      ) : (
        <ul className="mt-4 max-h-[62dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
          {shown.map((r) => (
            <li key={r.person.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
              >
                <PersonAvatar name={r.person.displayName} seed={r.person.id} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {r.person.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {r.history.length} khoản qua lại
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[13px] font-medium tabular-nums">
                    +{money(r.received)}
                  </span>
                  <span className="block font-mono text-[13px] font-medium tabular-nums text-lacquer">
                    −{money(r.given)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={Boolean(selected)}
        title={selected?.person.displayName ?? 'Người'}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div>
            <p className="text-sm text-muted">
              Đã nhận{' '}
              <span className="font-mono font-semibold text-ink">{money(selected.received)}</span>
              {' · Đã đi '}
              <span className="font-mono font-semibold text-lacquer">{money(selected.given)}</span>
            </p>
            {selected.history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Chưa có lịch sử qua lại.</p>
            ) : (
              <ul className="mt-3 max-h-[46dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {selected.history.map(({ entry, eventTitle, role }) => (
                  <li
                    key={entry.id}
                    className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{eventTitle}</span>
                      <span className="block text-xs text-muted">
                        {role === 'HOSTED' ? 'Nhận lễ' : 'Đi đám'} · {sourceLabel(entry.source)} ·{' '}
                        {new Date(entry.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                      {money(entry.amountVnd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

const RELATION_LABELS: Record<SodamRelationType, string> = {
  SPOUSE: 'Vợ/Chồng',
  PARENT: 'Cha/Mẹ',
  CHILD: 'Con',
  SIBLING: 'Anh/Chị/Em',
  OTHER: 'Họ hàng',
};

function TreeView({
  api,
  bookId,
  bookName,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  bookName?: string;
  onError: (m: string | null) => void;
}) {
  const [people, setPeople] = useState<SodamPerson[] | null>(null);
  const [relations, setRelations] = useState<SodamRelation[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [relType, setRelType] = useState<SodamRelationType>('OTHER');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRelId, setConfirmRelId] = useState<string | null>(null);
  const [relBusy, setRelBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const t = await api.tree(bookId);
      setPeople(t.people);
      setRelations(t.relations);
      setFromId((prev) => prev || t.people[0]?.id || '');
      setToId((prev) => prev || t.people[1]?.id || t.people[0]?.id || '');
      onError(null);
    } catch (e) {
      onError(friendlyError(e, 'Lỗi tải cây họ'));
    }
  }, [api, bookId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (people === null) {
    return <p className="text-sm text-muted">Đang tải cây họ…</p>;
  }

  const nameOf = (id: string) => people.find((p) => p.id === id)?.displayName ?? id;

  const removeRelation = async (relationId: string) => {
    setRelBusy(true);
    try {
      await api.deleteRelation(bookId, relationId);
      setConfirmRelId(null);
      await reload();
    } catch (e) {
      onError(friendlyError(e, 'Chưa xoá được quan hệ'));
    } finally {
      setRelBusy(false);
    }
  };

  return (
    <div>
      <h1 className="sr-only">Cây họ{bookName ? ` — ${bookName}` : ''}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {people.length} người · {relations.length} quan hệ đã gắn
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setListOpen(true)}>
            Quan hệ đã gắn
          </Btn>
          <Btn disabled={people.length < 2} onClick={() => setAttachOpen(true)}>
            <Plus className="size-4" /> Gắn quan hệ
          </Btn>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-card">
          <EmptyLedger
            title="Chưa có ai trong sổ"
            body="Ghi khoản đầu tiên ở mục Đám — mỗi người được ghi sẽ hiện ở đây để gắn quan hệ."
          />
        </div>
      ) : (
        <div className="mt-4 max-h-[58dvh] overflow-auto rounded-xl border border-line bg-card p-4">
          <div className="flex min-w-[560px] flex-wrap gap-2">
            {people.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pr-3 pl-1.5"
              >
                <PersonAvatar name={p.displayName} seed={p.id} size="sm" />
                <span className="text-sm font-medium">{p.displayName}</span>
              </span>
            ))}
          </div>
          {relations.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {relations.slice(0, 12).map((r) => (
                <li key={r.id} className="text-sm text-muted">
                  <span className="font-medium text-ink">{nameOf(r.fromPersonId)}</span>
                  {' — '}
                  {RELATION_LABELS[r.type] ?? r.type}
                  {' — '}
                  <span className="font-medium text-ink">{nameOf(r.toPersonId)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <Sheet open={attachOpen} title="Gắn quan hệ" onClose={() => setAttachOpen(false)}>
        <div className="space-y-3">
          <Field label="Từ người">
            <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Đến người">
            <Select value={toId} onChange={(e) => setToId(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Loại quan hệ" error={formError}>
            <Select
              value={relType}
              onChange={(e) => setRelType(e.target.value as SodamRelationType)}
            >
              {(Object.keys(RELATION_LABELS) as SodamRelationType[]).map((k) => (
                <option key={k} value={k}>
                  {RELATION_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Btn
            className="w-full"
            disabled={busy || !fromId || !toId}
            onClick={() => {
              if (fromId === toId) {
                setFormError('Hai người phải khác nhau — chọn lại người thứ hai.');
                return;
              }
              setFormError(null);
              setBusy(true);
              void api
                .createRelation(bookId, { fromPersonId: fromId, toPersonId: toId, type: relType })
                .then(async () => {
                  await reload();
                  setAttachOpen(false);
                })
                .catch((e: Error) => onError(friendlyError(e, 'Gắn quan hệ lỗi')))
                .finally(() => setBusy(false));
            }}
          >
            Gắn quan hệ
          </Btn>
        </div>
      </Sheet>

      <Sheet open={listOpen} title="Quan hệ đã gắn" onClose={() => setListOpen(false)}>
        {relations.length === 0 ? (
          <EmptyLedger
            title="Chưa có quan hệ nào"
            body="Bấm Gắn quan hệ để nối hai người đầu tiên trong cây họ."
          />
        ) : (
          <ul className="max-h-[56dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {relations.map((r) => (
              <li key={r.id} className="px-3.5 py-2.5 text-sm">
                <div className="flex min-h-12 items-center gap-2">
                  <PersonAvatar name={nameOf(r.fromPersonId)} seed={r.fromPersonId} size="sm" />
                  <span className="font-medium">{nameOf(r.fromPersonId)}</span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {RELATION_LABELS[r.type] ?? r.type}
                  </span>
                  <PersonAvatar name={nameOf(r.toPersonId)} seed={r.toPersonId} size="sm" />
                  <span className="font-medium">{nameOf(r.toPersonId)}</span>
                  <Btn
                    variant="ghost"
                    className="ml-auto shrink-0 text-lacquer hover:bg-lacquer/5"
                    aria-label={`Xoá quan hệ giữa ${nameOf(r.fromPersonId)} và ${nameOf(r.toPersonId)}`}
                    onClick={() => setConfirmRelId(r.id)}
                  >
                    <Trash2 className="size-4" />
                  </Btn>
                </div>
                {confirmRelId === r.id ? (
                  <div
                    role="group"
                    aria-label="Xác nhận xoá quan hệ"
                    className="mt-2 rounded-[10px] border border-lacquer bg-card px-3 py-3"
                  >
                    <p className="text-sm">
                      Xoá quan hệ {RELATION_LABELS[r.type] ?? r.type} giữa {nameOf(r.fromPersonId)}{' '}
                      và {nameOf(r.toPersonId)}? Cây họ sẽ không còn nối hai người này — các khoản
                      lễ trong sổ không thay đổi.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <Btn
                        variant="danger"
                        disabled={relBusy}
                        onClick={() => void removeRelation(r.id)}
                      >
                        Xoá hẳn
                      </Btn>
                      <Btn variant="secondary" onClick={() => setConfirmRelId(null)}>
                        Huỷ
                      </Btn>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
