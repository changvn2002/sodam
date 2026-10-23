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
  SodamPhotoCandidate,
  SodamRelation,
  SodamRelationType,
  SodamReturnItem,
} from './api/types';
import { cn } from '@/lib/utils';
import { knownBookCodes, rememberBook } from './lib/book-store';
import { useSodamOffline } from './lib/offline';
import { EVENT_KIND_LABELS, EVENT_KIND_ORDER, kindLabel } from './lib/event-kinds';
import { formatLunarVi, solarToLunar } from './lib/lunar';
import {
  Btn,
  Camera,
  EmptyState,
  Field,
  Input,
  Mic,
  Panel,
  QuickAction,
  SodamShell,
  StatTile,
  type SodamNavId,
} from './shell';
import { BookAvatar, PersonAvatar } from './ui/avatar';
import { LedgerRow } from './ui/ledger-row';
import {
  ArrowLeftRight,
  Banknote,
  BookMarked,
  Gift,
  HandCoins,
  Users as UsersLucide,
  ArrowRight,
} from 'lucide-react';

type View =
  | { name: 'home' }
  | { name: 'dashboard'; bookId: string }
  | { name: 'event'; bookId: string; eventId: string }
  | { name: 'voice'; bookId: string; eventId: string }
  | { name: 'photo'; bookId: string; eventId: string }
  | { name: 'returns'; bookId: string }
  | { name: 'tree'; bookId: string }
  | { name: 'people'; bookId: string };

const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Mốc tiền mừng quen thuộc — bấm để điền nhanh vào ô số tiền, vẫn sửa tay được. */
const QUICK_AMOUNTS = [100_000, 200_000, 300_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

/** Hiển thị số tiền có dấu chấm phân cách nghìn cho dễ đọc; state vẫn giữ chuỗi số thuần. */
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
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-3 text-[13px] font-medium tabular-nums text-ink transition-colors hover:border-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

const SOMBER_EVENT_KINDS = new Set(['MA', 'GIO']);

/** Lưới chọn loại đám: đủ 13 loại, nhóm gọn, nút chạm ≥44px cho dễ bấm trên điện thoại. */
function EventKindPicker({
  value,
  onChange,
}: {
  value: SodamEventKind;
  onChange: (kind: SodamEventKind) => void;
}) {
  const groups: Array<{ label: string; kinds: SodamEventKind[] }> = [
    {
      label: 'Đám vui',
      kinds: EVENT_KIND_ORDER.filter((k) => !SOMBER_EVENT_KINDS.has(k) && k !== 'KHAC'),
    },
    { label: 'Đám tưởng nhớ', kinds: EVENT_KIND_ORDER.filter((k) => SOMBER_EVENT_KINDS.has(k)) },
    { label: 'Khác', kinds: EVENT_KIND_ORDER.filter((k) => k === 'KHAC') },
  ];
  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.kinds.length > 0)
        .map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {group.label}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {group.kinds.map((k) => {
                const active = value === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange(k)}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-[13px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      active
                        ? 'border-lacquer bg-lacquer font-semibold text-card'
                        : 'border-line bg-paper text-ink hover:border-ink/25',
                    )}
                  >
                    {EVENT_KIND_LABELS[k] ?? kindLabel(k)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

function navFromView(view: View): SodamNavId {
  if (view.name === 'home') return 'home';
  if (view.name === 'returns') return 'returns';
  if (view.name === 'people') return 'people';
  if (view.name === 'tree') return 'tree';
  if (view.name === 'event' || view.name === 'voice' || view.name === 'photo') return 'event';
  return 'overview';
}

export function SodamApp() {
  const api = useMemo(() => createSodamApi(), []);
  const mode = resolveSodamApiMode();
  const [view, setView] = useState<View>({ name: 'home' });
  const [books, setBooks] = useState<SodamBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiBlocked, setAiBlocked] = useState(false);
  const { online, enqueue, flush } = useSodamOffline(api);
  const joinFromLinkTried = useRef(false);

  // No accounts: "my books" are resolved from the invite codes this device
  // has stored (created or joined here). See lib/book-store.
  const refreshBooks = useCallback(async () => {
    try {
      const list = await api.listBooks(mode === 'mock' ? [] : knownBookCodes());
      setBooks(list);
      // Keep the local registry in sync with what the server still knows.
      for (const b of list) rememberBook(b.id, b.inviteCode);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải sổ');
    }
  }, [api, mode]);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  // Share link (?code=XXXX): opening it joins the book and goes straight in —
  // that is the whole "invite" flow now that there are no accounts.
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

  useEffect(() => {
    if (online && view.name === 'dashboard') void flush(view.bookId);
  }, [online, view, flush]);

  const bookId = view.name === 'home' ? null : 'bookId' in view ? view.bookId : null;
  const activeBook = books.find((b) => b.id === bookId) ?? null;
  const showBookNav = view.name !== 'home' && Boolean(bookId);

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

  return (
    <SodamShell
      title="Sổ Đám"
      subtitle={view.name === 'home' ? 'Nhận lễ · trả lễ · với ai' : undefined}
      bookName={activeBook?.name}
      inviteCode={activeBook?.inviteCode}
      online={online}
      aiBlocked={aiBlocked}
      error={error}
      activeNav={navFromView(view)}
      onNav={onNav}
      showBookNav={showBookNav}
      onBackHome={() => setView({ name: 'home' })}
    >
      {view.name === 'home' ? (
        <HomeView
          books={books}
          onCreate={async (name) => {
            const book = await api.createBook(name);
            await refreshBooks();
            setView({ name: 'dashboard', bookId: book.id });
          }}
          onJoin={async (code) => {
            const trimmed = code.trim();
            if (trimmed.length < 3) {
              setError('Nhập mã sổ ít nhất 3 ký tự (mã trên sổ của người nhà).');
              return;
            }
            const book = await api.joinBook(trimmed);
            await refreshBooks();
            setView({ name: 'dashboard', bookId: book.id });
          }}
          onOpen={(id) => setView({ name: 'dashboard', bookId: id })}
        />
      ) : null}

      {view.name === 'dashboard' ? (
        <DashboardView
          api={api}
          bookId={view.bookId}
          onOpenEvent={(eventId) => setView({ name: 'event', bookId: view.bookId, eventId })}
          onVoice={(eventId) => setView({ name: 'voice', bookId: view.bookId, eventId })}
          onPhoto={(eventId) => setView({ name: 'photo', bookId: view.bookId, eventId })}
          onReturns={() => setView({ name: 'returns', bookId: view.bookId })}
          onError={setError}
        />
      ) : null}

      {view.name === 'event' ? (
        <EventView
          api={api}
          bookId={view.bookId}
          eventId={view.eventId}
          onBack={() => setView({ name: 'dashboard', bookId: view.bookId })}
          onVoice={() => setView({ name: 'voice', bookId: view.bookId, eventId: view.eventId })}
          onPhoto={() => setView({ name: 'photo', bookId: view.bookId, eventId: view.eventId })}
          enqueue={enqueue}
          online={online}
          onError={setError}
        />
      ) : null}

      {view.name === 'voice' ? (
        <VoiceView
          api={api}
          bookId={view.bookId}
          eventId={view.eventId}
          onBack={() => setView({ name: 'event', bookId: view.bookId, eventId: view.eventId })}
          onAiBlocked={() => setAiBlocked(true)}
          onError={setError}
        />
      ) : null}

      {view.name === 'photo' ? (
        <PhotoView
          api={api}
          bookId={view.bookId}
          eventId={view.eventId}
          onBack={() => setView({ name: 'event', bookId: view.bookId, eventId: view.eventId })}
          onAiBlocked={() => setAiBlocked(true)}
          onError={setError}
        />
      ) : null}

      {view.name === 'returns' ? (
        <ReturnsView api={api} bookId={view.bookId} onError={setError} />
      ) : null}

      {view.name === 'tree' ? <TreeView api={api} bookId={view.bookId} onError={setError} /> : null}

      {view.name === 'people' ? (
        <PeopleView api={api} bookId={view.bookId} onError={setError} />
      ) : null}
    </SodamShell>
  );
}

function HomeView({
  books,
  onCreate,
  onJoin,
  onOpen,
}: {
  books: SodamBook[];
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [name, setName] = useState('Sổ nhà');
  const [code, setCode] = useState('');

  return (
    <div className="space-y-6">
      {/* Dải chào gọn (bản E2): logo riêng + lời chào serif + chip tính năng.
          Không dùng hero lớn: người quay lại cần thấy sổ của mình ngay. */}
      <div className="rounded-3xl border border-line/70 bg-card px-5 py-6 shadow-[var(--shadow-card)] sm:px-7">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt="Logo Sổ Đám"
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-2xl shadow-[var(--shadow-card)] ring-1 ring-black/10"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-lacquer uppercase">
              Sổ Đám · Changto
            </p>
            <h1 className="font-serif-vn mt-1.5 text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">
              Sổ đám của nhà bạn
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Ghi nhận lễ bằng miệng hoặc ảnh, theo dõi trả lễ, tìm lại ai đã đi với mình — theo
              đúng nếp nhà mình.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs text-muted">
            <Mic className="size-3.5 text-accent" /> Voice + TTS
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs text-muted">
            <Camera className="size-3.5 text-accent" /> Ảnh sổ
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs text-muted">
            <UsersLucide className="size-3.5 text-accent" /> Đồng sổ
          </span>
        </div>
      </div>

      {/* Sổ của bạn lên trước: người quay lại mở sổ trong 1 chạm. */}
      <section aria-label="Sổ của bạn">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <h2 className="font-serif-vn text-xl font-semibold tracking-tight text-ink">
            Sổ của bạn
          </h2>
          <p className="text-xs text-muted">Bấm để mở — không cần nhập mã</p>
        </div>
        {books.length === 0 ? (
          <Panel>
            <EmptyState
              title="Chưa có sổ nào"
              body="Tạo sổ đầu tiên ở mục bên dưới để bắt đầu ghi nhận lễ và theo dõi trả lễ."
            />
          </Panel>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="group flex w-full items-center gap-3.5 rounded-3xl border border-line/70 bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-jade-deep/30 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <BookAvatar name={b.name} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {b.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-muted">
                      Mã sổ {b.inviteCode}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-jade-deep" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hai hành động tạo/vào sổ: thẻ ngang nhau, quét mắt 1 giây là hiểu. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tạo sổ mới" description="Đặt tên sổ theo nhà hoặc dịp, mở ra ghi ngay.">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Field label="Tên sổ mới">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Sổ cưới 2026"
                />
              </Field>
            </div>
            <Btn
              className="w-full shrink-0 self-end sm:w-auto"
              onClick={() => void onCreate(name.trim() || 'Sổ nhà')}
            >
              <BookMarked className="size-4" />
              Tạo sổ &amp; mở
            </Btn>
          </div>
        </Panel>

        <Panel
          title="Vào sổ bằng mã"
          description="Người nhà đã tạo sổ? Nhập mã sổ để ghi chung — hoặc mở link chia sẻ là vào thẳng."
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Field label="Mã sổ">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VD: A1B2C3D4E5F6"
                  className="uppercase"
                  autoComplete="off"
                />
              </Field>
            </div>
            <Btn
              variant="secondary"
              className="w-full shrink-0 self-end sm:w-auto"
              onClick={() => {
                if (code.trim().length < 3) return;
                void onJoin(code.trim());
              }}
            >
              <Gift className="size-4" />
              Vào sổ
            </Btn>
          </div>
        </Panel>
      </div>

      <SeasonCard firstBookId={books[0]?.id} onOpen={onOpen} />
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

/**
 * Thẻ mùa lễ dưới chân trang (mẫu F3 user chốt 2026-10-09):
 * ngọc đậm, phong bì sơn mài vẽ tay, đếm ngày tới Tết theo âm lịch thật.
 */
function SeasonCard({
  firstBookId,
  onOpen,
}: {
  firstBookId?: string;
  onOpen: (id: string) => void;
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const title =
    month >= 9 ? 'Mùa cưới tháng 9–12' : month <= 2 ? 'Mùa Tết đoàn viên' : 'Mùa lễ đang tới';
  const tet = nextTet(now);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

  return (
    <section
      aria-label="Mùa lễ đang tới"
      className="relative overflow-hidden rounded-3xl bg-jade-deep p-5 text-[#FAF6EF] shadow-[var(--shadow-lift)] sm:p-6"
    >
      <svg
        className="pointer-events-none absolute -top-2 right-0 h-full w-28 opacity-80 sm:w-52 sm:opacity-90"
        viewBox="0 0 150 120"
        aria-hidden
      >
        <g transform="rotate(12 60 50)">
          <rect x="34" y="18" width="52" height="66" rx="5" fill="#B3352C" />
          <path d="M36 22 L60 44 L84 22" stroke="#F2D98C" strokeWidth="2.5" fill="none" />
          <circle cx="60" cy="62" r="9" fill="none" stroke="#E9C767" strokeWidth="2.5" />
          <rect x="56.5" y="58.5" width="7" height="7" fill="#07332B" />
        </g>
        <g transform="rotate(-9 102 66)">
          <rect x="80" y="36" width="44" height="58" rx="5" fill="#8C2820" />
          <path d="M82 40 L102 57 L122 40" stroke="#F2D98C" strokeWidth="2.2" fill="none" />
          <circle cx="102" cy="76" r="7" fill="none" stroke="#E9C767" strokeWidth="2.2" />
          <rect x="99" y="73" width="6" height="6" fill="#07332B" />
        </g>
        <circle cx="128" cy="18" r="3.5" fill="#E9C767" />
        <circle cx="18" cy="10" r="2.5" fill="#E9C767" opacity=".7" />
        <circle cx="140" cy="52" r="2.5" fill="#E9C767" opacity=".6" />
      </svg>

      <div className="relative">
        <p className="text-[10px] font-bold tracking-[0.2em] text-gold uppercase">
          Mùa lễ đang tới
        </p>
        <h3 className="font-serif-vn mt-1.5 text-[21px] font-semibold text-[#FFFDF8]">{title}</h3>
        <p className="mt-1.5 max-w-[15.5rem] text-[13px] leading-relaxed text-[#FAF6EF]/75 sm:max-w-sm">
          {firstBookId
            ? 'Mở sổ để xem các đám sắp tới và những khoản cần trả lễ trong mùa này.'
            : 'Tạo cuốn sổ đầu tiên để nhà mình không bỏ sót một đám nào trong mùa lễ.'}
          {tet ? (
            <>
              {' '}
              Còn <b className="text-gold">{tet.days} ngày</b> tới Tết Nguyên đán ({fmt(tet.date)}).
            </>
          ) : null}
        </p>
        {firstBookId ? (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onOpen(firstBookId)}
              className="inline-flex min-h-11 items-center rounded-xl bg-lacquer px-4 text-[13px] font-semibold text-white transition-colors hover:bg-lacquer/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Xem lịch đám
            </button>
            <button
              type="button"
              onClick={() => onOpen(firstBookId)}
              className="inline-flex min-h-11 items-center rounded-xl border border-gold/50 px-4 text-[13px] font-semibold text-gold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Nhắc trả lễ
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DashboardView({
  api,
  bookId,
  onOpenEvent,
  onVoice,
  onPhoto,
  onReturns,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  onOpenEvent: (id: string) => void;
  onVoice: (id: string) => void;
  onPhoto: (id: string) => void;
  onReturns: () => void;
  onError: (m: string | null) => void;
}) {
  const [dash, setDash] = useState<SodamDashboard | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<SodamEventKind>('CUOI');
  const [newRole, setNewRole] = useState<SodamEventRole>('HOSTED');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [creating, setCreating] = useState(false);
  const reload = useCallback(async () => {
    try {
      setDash(await api.dashboard(bookId));
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Lỗi dashboard');
    }
  }, [api, bookId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!dash) {
    return <p className="text-sm text-muted">Đang tải sổ…</p>;
  }

  const ensureHosted = async () => {
    if (dash.openEvent?.role === 'HOSTED') return dash.openEvent.id;
    const ev = await api.createEvent(bookId, {
      title: 'Đám nhận lễ',
      kind: 'CUOI',
      role: 'HOSTED',
    });
    return ev.id;
  };

  const createNewEvent = async () => {
    setCreating(true);
    try {
      const ev = await api.createEvent(bookId, {
        title: newTitle.trim() || kindLabel(newKind),
        kind: newKind,
        role: newRole,
        occurredOn: newDate || undefined,
      });
      onOpenEvent(ev.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Tạo đám lỗi');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Còn giữ (sau trả lễ)"
          value={money(dash.totals.receivedVnd)}
          icon={Banknote}
          featured
        />
        <StatTile
          label="Khách đã mừng"
          value={money(dash.totals.receivedGrossVnd ?? dash.totals.receivedVnd)}
          icon={Gift}
        />
        <StatTile label="Đã trả / đi" value={money(dash.totals.givenVnd)} icon={HandCoins} />
        <StatTile
          label="Cần trả lễ"
          value={
            dash.totals.pendingReturnVnd != null && dash.totals.pendingReturnVnd > 0
              ? money(dash.totals.pendingReturnVnd)
              : String(dash.openReturnCount)
          }
          icon={ArrowLeftRight}
        />
      </div>

      {(dash.totals.overGivenVnd ?? 0) > 0 || (dash.totals.settledVnd ?? 0) > 0 ? (
        <div className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          <p className="font-medium text-ink">Công thức sổ</p>
          <p className="mt-1 text-muted">
            Tổng mừng {money(dash.totals.receivedGrossVnd ?? 0)} − đã trừ trả lễ{' '}
            {money(dash.totals.settledVnd ?? 0)} = còn giữ {money(dash.totals.receivedVnd)}
            {(dash.totals.overGivenVnd ?? 0) > 0 ? (
              <>
                {' '}
                ·{' '}
                <span className="font-semibold text-accent">
                  đi nhiều hơn {money(dash.totals.overGivenVnd!)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickAction
          icon={Mic}
          label="Nhận lễ — Voice"
          hint="Ghi khách + tiền khi tổ chức đám"
          tone="accent"
          onClick={() => void ensureHosted().then(onVoice)}
        />
        <QuickAction
          icon={Camera}
          label="Nhận lễ — Ảnh"
          hint="Chụp sổ giấy, duyệt từng dòng"
          onClick={() => void ensureHosted().then(onPhoto)}
        />
        <QuickAction
          icon={UsersLucide}
          label="Danh sách trả lễ"
          hint={
            dash.openReturnCount > 0
              ? `${dash.openReturnCount} khách · ${money(dash.totals.pendingReturnVnd ?? 0)}`
              : 'Chưa có khoản mở'
          }
          onClick={onReturns}
        />
      </div>

      <Panel
        title="Tạo đám mới"
        description="Chọn loại đám theo nếp Việt, ghi ngày dương — app tự hiện ngày âm bên dưới."
      >
        <div className="space-y-4">
          <Field label="Tên đám">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`VD: ${kindLabel(newKind)} nhà mình`}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Loại đám</p>
            <EventKindPicker value={newKind} onChange={setNewKind} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Vai trò</p>
              <div
                className="grid grid-cols-2 gap-1.5"
                role="group"
                aria-label="Vai trò của nhà mình"
              >
                {(
                  [
                    { id: 'HOSTED', label: 'Nhận lễ' },
                    { id: 'ATTENDED', label: 'Đi đám' },
                  ] as Array<{ id: SodamEventRole; label: string }>
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={newRole === r.id}
                    onClick={() => setNewRole(r.id)}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-xl border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      newRole === r.id
                        ? 'border-lacquer bg-lacquer font-semibold text-card'
                        : 'border-line bg-paper text-ink hover:border-ink/25',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Ngày (dương lịch)">
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </Field>
          </div>
          {newKind === 'GIO' ? (
            <p className="rounded-xl bg-[#E8F7F4] px-3 py-2 text-xs font-medium text-accent">
              Đám giỗ tính theo ngày âm — app sẽ hiện ngày âm của đám để nhà mình đối chiếu hằng
              năm.
            </p>
          ) : null}
          <Btn
            className="w-full sm:w-auto"
            disabled={creating}
            onClick={() => void createNewEvent()}
          >
            Tạo đám & mở sổ
          </Btn>
        </div>
      </Panel>

      {dash.openEvent ? (
        <Panel
          title="Đám đang ghi"
          description={dash.openEvent.title}
          action={
            <Btn variant="secondary" onClick={() => onOpenEvent(dash.openEvent!.id)}>
              Mở sổ khách
            </Btn>
          }
        >
          <p className="text-sm text-muted">
            {kindLabel(dash.openEvent.kind)} ·{' '}
            {dash.openEvent.role === 'HOSTED' ? 'Nhận lễ' : 'Đi đám'} · tổng mừng{' '}
            {money(dash.openEvent.totalAmountVnd ?? 0)} · {dash.openEvent.entryCount ?? 0} khách
          </p>
          {(() => {
            const dates = eventDateLabels(dash.openEvent.occurredOn);
            return dates ? (
              <p className="mt-1 text-sm text-muted">
                Ngày {dates.solar}
                {dates.lunar ? (
                  <span className="block text-xs text-muted/80">{dates.lunar}</span>
                ) : null}
              </p>
            ) : null;
          })()}
        </Panel>
      ) : null}

      <Panel title="Excel / CSV" description="Xuất hoặc nhập danh sách nhanh.">
        <ExcelBar api={api} bookId={bookId} onError={onError} />
      </Panel>

      <Panel title="Đám gần đây">
        {dash.recentEvents.length === 0 ? (
          <EmptyState title="Chưa có đám" body="Tạo đám nhận lễ để ghi khách và tiền." />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line">
            {dash.recentEvents.map((e) => {
              const dates = eventDateLabels(e.occurredOn);
              return (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <BookAvatar name={e.title} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{e.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {kindLabel(e.kind)} · {e.role === 'HOSTED' ? 'Nhận lễ' : 'Đi đám'}
                        {e.totalAmountVnd != null ? ` · ${money(e.totalAmountVnd)}` : ''}
                      </span>
                      {dates ? (
                        <span className="mt-0.5 block text-[11px] text-muted/80">
                          {dates.solar}
                          {dates.lunar ? ` · ${dates.lunar}` : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted">
                      Mở
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ExcelBar({
  api,
  bookId,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  onError: (m: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Btn
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={() =>
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
              onError(e instanceof Error ? e.message : 'Export lỗi');
            }
          })()
        }
      >
        Xuất CSV
      </Btn>
      <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-card px-4 text-sm font-medium transition-colors hover:bg-paper sm:w-auto">
        Nhập CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then(async (csv) => {
              try {
                await api.importCsv(bookId, csv);
                onError(null);
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Import lỗi');
              }
            });
          }}
        />
      </label>
    </div>
  );
}

function EventView({
  api,
  bookId,
  eventId,
  onBack,
  onVoice,
  onPhoto,
  enqueue,
  online,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  eventId: string;
  onBack: () => void;
  onVoice: () => void;
  onPhoto: () => void;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  online: boolean;
  onError: (m: string | null) => void;
}) {
  const [event, setEvent] = useState<(SodamEvent & { entries: SodamEntry[] }) | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('500000');

  const reload = useCallback(async () => {
    try {
      setEvent(await api.getEvent(bookId, eventId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Lỗi đám');
    }
  }, [api, bookId, eventId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!event) return <p className="text-sm text-muted">Đang tải đám…</p>;

  const isHosted = event.role === 'HOSTED';
  const gross = event.totalAmountVnd ?? 0;
  const settled = event.settledVnd ?? 0;
  const net = event.netTotalVnd ?? Math.max(0, gross - settled);
  const over = event.overGivenVnd ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={onBack}>
          ← Tổng quan
        </Btn>
        <div className="min-w-0">
          <h2 className="font-serif-vn truncate text-[22px] font-semibold tracking-tight">
            {event.title}
          </h2>
          <p className="text-sm text-muted">
            {kindLabel(event.kind)} · {isHosted ? 'Nhận lễ' : 'Đi đám'} · {event.entryCount ?? 0}{' '}
            khách
          </p>
          {(() => {
            const dates = eventDateLabels(event.occurredOn);
            if (!dates) return null;
            return (
              <>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>Ngày {dates.solar} (dương lịch)</span>
                  {dates.lunar ? (
                    <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-[#7A5A14]">
                      {dates.lunar}
                    </span>
                  ) : null}
                </p>
                {event.kind === 'GIO' && dates.lunar ? (
                  <p className="mt-2 inline-block rounded-xl bg-gold-soft px-3 py-2 text-xs font-medium text-[#7A5A14]">
                    Đám giỗ tính theo ngày âm ({dates.lunar}) — mỗi năm nhà mình đối chiếu đúng ngày
                    âm này.
                  </p>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>

      {isHosted ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Tổng mừng" value={money(gross)} icon={Gift} />
          <StatTile label="Còn giữ" value={money(net)} icon={Banknote} />
          <StatTile label="Đã trừ trả lễ" value={money(settled)} icon={ArrowLeftRight} />
          <StatTile label="Đi nhiều hơn" value={money(over)} icon={HandCoins} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
          <StatTile label="Tổng đã đưa" value={money(gross)} icon={HandCoins} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Btn onClick={onVoice} className="w-full">
          <Mic className="size-4" /> Ghi bằng miệng
        </Btn>
        <Btn variant="secondary" onClick={onPhoto} className="w-full">
          <Camera className="size-4" /> Chụp ảnh sổ
        </Btn>
      </div>

      <Panel title="Thêm khách" description="Tên + số tiền khách mừng.">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <Field label="Tên">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ tên" />
          </Field>
          <Field label="Số tiền">
            <Input
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <div className="flex items-end">
            <Btn
              className="w-full"
              onClick={() =>
                void (async () => {
                  const amountVnd = Number(amount.replace(/\D/g, '')) || 0;
                  if (!name.trim()) return;
                  try {
                    if (!online) {
                      enqueue(bookId, 'createEntry', {
                        eventId,
                        personName: name.trim(),
                        amountVnd,
                        source: 'MANUAL',
                      });
                    } else {
                      await api.createEntry(bookId, eventId, {
                        personName: name.trim(),
                        amountVnd,
                        source: 'MANUAL',
                      });
                    }
                    setName('');
                    await reload();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Ghi lỗi');
                  }
                })()
              }
            >
              Thêm
            </Btn>
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">Chọn nhanh số tiền</p>
          <QuickAmounts onPick={(v) => setAmount(String(v))} />
        </div>
      </Panel>

      <Panel
        title="Sổ khách"
        description={
          isHosted
            ? 'Mỗi hàng: tiền khách mừng + ô trả lễ. Tổng trừ đúng số họ đã mừng; nếu đi nhiều hơn sẽ ghi rõ.'
            : 'Danh sách tiền đã đưa khi đi đám.'
        }
      >
        {event.entries.length === 0 ? (
          <EmptyState
            title="Chưa có khách"
            body="Ghi miệng, chụp ảnh sổ giấy, hoặc thêm tay bên trên."
          />
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {event.entries.map((e) => (
              <li key={e.id}>
                {isHosted ? (
                  <GuestReturnRow
                    entry={e}
                    onMark={(returnId, amountVnd) =>
                      void api
                        .markReturn(bookId, returnId, { status: 'DONE', amountVnd })
                        .then(reload)
                        .catch((err: Error) => onError(err.message))
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <LedgerRow
                      name={e.personName}
                      amountLabel={money(e.amountVnd)}
                      meta={`${e.source} · ${new Date(e.createdAt).toLocaleString('vi-VN')}`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function GuestReturnRow({
  entry,
  onMark,
}: {
  entry: SodamEntry;
  onMark: (returnId: string, amountVnd: number) => void;
}) {
  const received = entry.amountVnd;
  const ret = entry.returnItem;
  const defaultPay = ret?.receivedAmountVnd ?? received;
  const [pay, setPay] = useState(String(defaultPay));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPay(String(ret?.receivedAmountVnd ?? received));
  }, [ret?.receivedAmountVnd, received, entry.id]);

  const payNum = Number(pay.replace(/\D/g, '')) || 0;
  const delta = payNum - received;

  if (ret?.status === 'DONE') {
    const paid = ret.returnedAmountVnd ?? received;
    const over = ret.overGivenVnd ?? Math.max(0, paid - (ret.receivedAmountVnd ?? received));
    return (
      <div className="rounded-2xl border border-line bg-card p-3.5">
        <div className="flex items-center gap-3">
          <PersonAvatar name={entry.personName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{entry.personName}</p>
            <p className="mt-0.5 text-xs text-muted">
              Mừng {money(ret.receivedAmountVnd ?? received)} · đã trả {money(paid)}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-muted">
            Đã trả lễ
          </span>
        </div>
        {over > 0 ? (
          <p className="mt-2 rounded-xl bg-[#E8F7F4] px-3 py-2 text-xs font-medium text-accent">
            Đi nhiều hơn {money(over)} so với số khách đã mừng — tổng sổ chỉ trừ{' '}
            {money(ret.receivedAmountVnd ?? received)}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Trả đúng số khách đã mừng · đã trừ khỏi tổng còn giữ.
          </p>
        )}
      </div>
    );
  }

  if (ret?.status === 'SKIPPED') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-paper/80 p-3.5">
        <PersonAvatar name={entry.personName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{entry.personName}</p>
          <p className="text-xs text-muted">Mừng {money(received)} · đã bỏ qua trả lễ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-center gap-3">
        <PersonAvatar name={entry.personName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{entry.personName}</p>
          <p className="mt-0.5 text-xs text-muted">
            Khách mừng <span className="font-mono font-semibold text-ink">{money(received)}</span>
            <span className="mx-1.5 text-line">·</span>
            {entry.source}
          </p>
        </div>
      </div>
      {ret?.id ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Trả lễ (số mình đi)">
              <Input
                inputMode="numeric"
                value={formatAmountInput(pay)}
                onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))}
                aria-label={`Trả lễ cho ${entry.personName}`}
              />
            </Field>
            <Btn
              disabled={busy || payNum <= 0 || !ret?.id}
              onClick={() => {
                if (!ret?.id) return;
                setBusy(true);
                Promise.resolve(onMark(ret.id, payNum)).finally(() => setBusy(false));
              }}
            >
              Xác nhận trả
            </Btn>
            {delta > 0 ? (
              <p className="text-xs font-medium text-accent sm:col-span-2">
                Sẽ ghi đi nhiều hơn {money(delta)} — tổng còn giữ chỉ trừ {money(received)}.
              </p>
            ) : delta < 0 ? (
              <p className="text-xs text-muted sm:col-span-2">
                Trả ít hơn số mừng {money(-delta)} — vẫn trừ đủ {money(received)} khỏi tổng còn giữ.
              </p>
            ) : (
              <p className="text-xs text-muted sm:col-span-2">Trả đúng số khách đã mừng.</p>
            )}
          </div>
          <div className="mt-2">
            <QuickAmounts onPick={(v) => setPay(String(v))} />
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">Đang đồng bộ nghĩa vụ trả lễ…</p>
      )}
    </div>
  );
}

function VoiceView({
  api,
  bookId,
  eventId,
  onBack,
  onAiBlocked,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  eventId: string;
  onBack: () => void;
  onAiBlocked: () => void;
  onError: (m: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pending, setPending] = useState<SodamParseResult | null>(null);
  const recogRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const wantListen = useRef(false);

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
      const parsed = await api.parseUtterance(bookId, text);
      setPending(parsed);
      speak(parsed.speakBack);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI lỗi';
      if (/blocked|403|Forbidden|khóa/i.test(msg)) onAiBlocked();
      onError(msg);
    }
  };

  const start = () => {
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
      onError('Trình duyệt không hỗ trợ Web Speech — nhập tay ở màn đám.');
      return;
    }
    const recog = new SR();
    recog.lang = 'vi-VN';
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (ev) => {
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) void handleUtterance(finalText.trim());
    };
    recog.onend = () => {
      if (wantListen.current) {
        try {
          recog.start();
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    recogRef.current = recog;
    wantListen.current = true;
    recog.start();
    setListening(true);
  };

  const stop = () => {
    wantListen.current = false;
    recogRef.current?.stop();
    setListening(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Btn variant="ghost" onClick={onBack}>
        ← Quay lại sổ
      </Btn>
      <Panel
        title="Ghi miệng"
        description="Nghe liên tục trong màn này. Mỗi câu AI đọc lại — chỉ lưu khi bấm Đúng."
      >
        <Btn
          className="w-full"
          variant={listening ? 'danger' : 'primary'}
          onClick={() => (listening ? stop() : start())}
        >
          <Mic className="size-4" />
          {listening ? 'Dừng nghe' : 'Bắt đầu nghe liên tục'}
        </Btn>
        <p className="mt-4 rounded-xl border border-line bg-paper px-3 py-3 text-sm">
          <span className="text-xs font-medium text-muted">Vừa nghe</span>
          <span className="mt-1 block text-ink">{transcript || '…'}</span>
        </p>
        {pending ? (
          <div className="mt-4 space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm leading-relaxed">{pending.speakBack}</p>
            <div className="grid grid-cols-2 gap-2">
              <Btn
                onClick={() =>
                  void (async () => {
                    if (!pending.name || pending.amountVnd == null) return;
                    await api.createEntry(bookId, eventId, {
                      personName: pending.name,
                      amountVnd: pending.amountVnd,
                      source: 'VOICE',
                      rawText: pending.rawText,
                    });
                    setPending(null);
                  })()
                }
              >
                Đúng — lưu
              </Btn>
              <Btn variant="secondary" onClick={() => setPending(null)}>
                Sai — nói lại
              </Btn>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function PhotoView({
  api,
  bookId,
  eventId,
  onBack,
  onAiBlocked,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  eventId: string;
  onBack: () => void;
  onAiBlocked: () => void;
  onError: (m: string | null) => void;
}) {
  const [rows, setRows] = useState<SodamPhotoCandidate[]>([]);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Btn variant="ghost" onClick={onBack}>
        ← Quay lại sổ
      </Btn>
      <Panel title="Ảnh sổ" description="Chụp hoặc chọn ảnh — duyệt từng dòng trước khi vào sổ.">
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-jade-deep px-4 text-sm font-medium text-[#FAF6EF] transition-colors hover:bg-jade-deep/90">
          <Camera className="size-4" />
          Chọn / chụp ảnh
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void api
                .photoCandidates(bookId, file)
                .then((r) => setRows(r.candidates))
                .catch((err: Error) => {
                  if (/blocked|403|Forbidden/i.test(err.message)) onAiBlocked();
                  onError(err.message);
                });
            }}
          />
        </label>
        {rows.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted">Chưa có dòng nào — chọn ảnh để OCR.</p>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
            {rows.map((r, i) => (
              <li key={`${r.name}-${i}`} className="border-b border-line last:border-b-0">
                <LedgerRow
                  name={r.name}
                  amountLabel={money(r.amountVnd)}
                  meta="Từ ảnh · chờ xác nhận"
                  trailing={
                    <span className="flex shrink-0 gap-1.5">
                      <Btn
                        onClick={() =>
                          void api
                            .createEntry(bookId, eventId, {
                              personName: r.name,
                              amountVnd: r.amountVnd,
                              source: 'PHOTO',
                            })
                            .then(() => setRows((prev) => prev.filter((_, j) => j !== i)))
                        }
                      >
                        Đúng
                      </Btn>
                      <Btn
                        variant="secondary"
                        onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Bỏ
                      </Btn>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ReturnsView({
  api,
  bookId,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  onError: (m: string | null) => void;
}) {
  const [rows, setRows] = useState<SodamReturnItem[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const reload = useCallback(async () => {
    try {
      const list = await api.listReturns(bookId, 'OPEN');
      setRows(list);
      setAmounts((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (next[r.id] == null) {
            next[r.id] = String(r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0);
          }
        }
        return next;
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Lỗi trả lễ');
    }
  }, [api, bookId, onError]);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <Panel
      title="Cần trả lễ"
      description="Nhập số mình đi. Tổng sổ trừ đúng số khách đã mừng; phần đi nhiều hơn được ghi riêng."
    >
      {rows.length === 0 ? (
        <EmptyState
          title="Không còn khoản mở"
          body="Khi có khách mừng trong đám nhận lễ, họ hiện ở đây và trên từng hàng sổ khách."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const received = r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0;
            const payStr = amounts[r.id] ?? String(received);
            const payNum = Number(payStr.replace(/\D/g, '')) || 0;
            const over = Math.max(0, payNum - received);
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={r.personName ?? r.personId} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{r.personName ?? r.personId}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.fromEventTitle ? `${r.fromEventTitle} · ` : ''}
                      Họ đã mừng{' '}
                      <span className="font-mono font-semibold text-ink">{money(received)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <Field label="Số mình trả">
                    <Input
                      inputMode="numeric"
                      value={formatAmountInput(payStr)}
                      onChange={(e) =>
                        setAmounts((m) => ({ ...m, [r.id]: e.target.value.replace(/\D/g, '') }))
                      }
                    />
                  </Field>
                  <Btn
                    onClick={() =>
                      void api
                        .markReturn(bookId, r.id, { status: 'DONE', amountVnd: payNum })
                        .then(reload)
                        .catch((err: Error) => onError(err.message))
                    }
                  >
                    Đã trả
                  </Btn>
                  <Btn
                    variant="secondary"
                    onClick={() =>
                      void api.markReturn(bookId, r.id, { status: 'SKIPPED' }).then(reload)
                    }
                  >
                    Bỏ qua
                  </Btn>
                </div>
                <div className="mt-2">
                  <QuickAmounts onPick={(v) => setAmounts((m) => ({ ...m, [r.id]: String(v) }))} />
                </div>
                {over > 0 ? (
                  <p className="mt-2 text-xs font-medium text-accent">
                    Đi nhiều hơn {money(over)} — tổng còn giữ chỉ trừ {money(received)}.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    Trả đúng / ít hơn: vẫn trừ {money(received)} khỏi tổng còn giữ.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
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
  onError,
}: {
  api: SodamApi;
  bookId: string;
  onError: (m: string | null) => void;
}) {
  const [people, setPeople] = useState<SodamPerson[] | null>(null);
  const [relations, setRelations] = useState<SodamRelation[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [relType, setRelType] = useState<SodamRelationType>('OTHER');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const t = await api.tree(bookId);
      setPeople(t.people);
      setRelations(t.relations);
      setFromId((prev) => prev || t.people[0]?.id || '');
      setToId((prev) => {
        if (prev && prev !== (t.people[0]?.id ?? '')) return prev;
        return t.people[1]?.id ?? t.people[0]?.id ?? '';
      });
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Lỗi cây họ');
    }
  }, [api, bookId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (people === null) {
    return (
      <Panel title="Cây họ hàng" description="Đang tải…">
        <div className="flex min-h-[220px] items-center justify-center">
          <p className="text-sm text-muted">Đang tải danh sách người trong sổ…</p>
        </div>
      </Panel>
    );
  }

  if (people.length === 0) {
    return (
      <Panel title="Cây họ hàng" description="Gắn quan hệ để tra cứu trong nhà.">
        <div className="rounded-2xl border border-dashed border-line bg-paper px-4 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/sodam-tree.svg"
            alt=""
            width={480}
            height={280}
            className="mx-auto h-auto w-full max-w-sm"
          />
          <h3 className="mt-4 text-center font-display text-lg font-semibold text-ink">
            Chưa có ai trong sổ
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-relaxed text-muted">
            Ghi nhận lễ trước (voice / ảnh / tay) — mỗi khách sẽ hiện ở đây để gắn vợ chồng, anh
            chị, họ hàng.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Cây họ hàng"
        description="Chọn hai người và loại quan hệ — dùng khi hỏi “với ai” trong nhà."
      >
        <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/sodam-tree.svg"
            alt=""
            width={480}
            height={280}
            className="mx-auto h-auto w-full max-w-lg object-contain px-4 pt-4"
          />
          <div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
            {people.slice(0, 8).map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-2.5 py-1.5"
              >
                <PersonAvatar name={p.displayName} size="sm" />
                <span className="max-w-[7rem] truncate text-xs font-medium text-ink">
                  {p.displayName}
                </span>
              </span>
            ))}
            {people.length > 8 ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-line bg-card px-3 text-xs text-muted">
                +{people.length - 8} người
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Từ người">
            <select
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none transition hover:border-ink/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Đến người">
            <select
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none transition hover:border-ink/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loại quan hệ">
            <select
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none transition hover:border-ink/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={relType}
              onChange={(e) => setRelType(e.target.value as SodamRelationType)}
            >
              {(Object.keys(RELATION_LABELS) as SodamRelationType[]).map((k) => (
                <option key={k} value={k}>
                  {RELATION_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Btn
              className="w-full"
              disabled={busy || !fromId || !toId || fromId === toId}
              onClick={() =>
                void (async () => {
                  if (!fromId || !toId || fromId === toId) return;
                  setBusy(true);
                  try {
                    await api.createRelation(bookId, {
                      fromPersonId: fromId,
                      toPersonId: toId,
                      type: relType,
                    });
                    await reload();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Gắn quan hệ lỗi');
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              Gắn quan hệ
            </Btn>
          </div>
        </div>
      </Panel>

      <Panel
        title="Quan hệ đã gắn"
        description={
          relations.length === 0
            ? 'Chưa có liên kết — gắn cặp đầu tiên ở trên.'
            : `${relations.length} liên kết trong sổ`
        }
      >
        {relations.length === 0 ? (
          <EmptyState
            title="Cây còn trống"
            body="Chọn hai người và loại quan hệ rồi bấm Gắn quan hệ. Sau đó tra cứu “với ai” sẽ rõ hơn."
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line">
            {relations.map((r) => {
              const from =
                people.find((p) => p.id === r.fromPersonId)?.displayName ?? r.fromPersonId;
              const to = people.find((p) => p.id === r.toPersonId)?.displayName ?? r.toPersonId;
              return (
                <li
                  key={r.id}
                  className="flex min-h-14 flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5 last:border-b-0"
                >
                  <PersonAvatar name={from} size="sm" />
                  <span className="max-w-[8rem] truncate text-xs font-semibold text-ink sm:max-w-none">
                    {from}
                  </span>
                  <span className="rounded-full border border-accent/25 bg-[#E8F7F4] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
                    {RELATION_LABELS[r.type] ?? r.type}
                  </span>
                  <PersonAvatar name={to} size="sm" />
                  <span className="min-w-0 truncate text-xs font-semibold text-ink">{to}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function PeopleView({
  api,
  bookId,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  onError: (m: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Array<SodamPerson & { history: SodamEntry[] }>>([]);

  return (
    <Panel title="Tìm người" description="Lịch sử nhận / đi xuyên các đám.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="min-w-0 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nhập tên…"
        />
        <Btn
          onClick={() =>
            void api
              .searchPeople(bookId, q)
              .then(setRows)
              .catch((e: Error) => onError(e.message))
          }
        >
          Tìm
        </Btn>
      </div>
      <ul className="mt-4 space-y-4">
        {rows.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center gap-3 border-b border-line bg-paper/60 px-3.5 py-3">
              <PersonAvatar name={p.displayName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{p.displayName}</p>
                <p className="text-xs text-muted">{p.note || 'Không ghi chú'}</p>
              </div>
            </div>
            {p.history.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-muted">Chưa có lịch sử.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.history.slice(0, 5).map((h) => (
                  <li
                    key={h.id}
                    className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted">
                      {h.source}
                      <span className="mx-1.5 text-line">·</span>
                      {new Date(h.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-ink">
                      {money(h.amountVnd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
