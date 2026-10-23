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
import { knownBookCodes, knownBooks, rememberBook } from './lib/book-store';
import { useSodamOffline } from './lib/offline';
import { EVENT_KIND_LABELS, EVENT_KIND_ORDER, kindLabel } from './lib/event-kinds';
import {
  GROUP_STYLE,
  groupOfKind,
  lexiconForKind,
  relationOrderForGroup,
  sourceLabel,
} from './lib/lexicon';
import { formatLunarVi, solarToLunar } from './lib/lunar';
import {
  Btn,
  CommandBar,
  EmptyLedger,
  Field,
  Input,
  SegmentedTabs,
  Select,
  Sheet,
  StatusPill,
  TotalsStrip,
  WorkspaceShell,
  formatInviteCode,
  type SodamFace,
} from './shell';
import { BookAvatar, PersonAvatar } from './ui/avatar';
import { KindIcon } from './ui/kind-icon';
import { LedgerRow } from './ui/ledger-row';
import { OfflineBanner, OutboxChip } from './ui/offline-ui';
import { ToastStack, type ToastData } from './ui/toast';
import InfoSections from '@/components/seo/InfoSections';
import { Check, ChevronRight, Mic, MoreVertical, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';

type Face = SodamFace;

type GhostEntry = { eventId: string; personName: string; amountVnd: number; source: string };

const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Chuỗi lỗi thô của fetch không bao giờ tới UI (F-W5-05) — ánh xạ sang tiếng Việt. */
function friendlyError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.';
  }
  return msg || fallback;
}

/** Mốc tiền quen thuộc — chỉ điền khi người dùng chạm vào. */
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

/** Câu hệ quả trả lễ theo 3 tình huống (COPY-DIET §4 — thay toàn bộ câu cũ). */
function returnConsequence(pay: number, received: number, name: string): string {
  if (pay < received) {
    return `Trả ${money(pay)} trong ${money(received)} đã nhận — phần còn lại ${money(received - pay)} vẫn ở khoản Chờ trả.`;
  }
  if (pay > received) {
    return `Trả ${money(pay)}, nhiều hơn ${money(received)} đã nhận — phần dư ${money(pay - received)} được ghi là Trả dư.`;
  }
  return `Trả ${money(pay)} — sổ sẽ ghi bạn đã trả đủ cho ${name}.`;
}

type PushToast = (
  message: string,
  action?: { label: string; run: () => void | Promise<void> },
) => void;

export function SodamApp() {
  const api = useMemo(() => createSodamApi(), []);
  const mode = resolveSodamApiMode();
  const [bookId, setBookId] = useState<string | null>(null);
  const [face, setFace] = useState<Face>('overview');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [returnsEventFilter, setReturnsEventFilter] = useState<string | null>(null);
  const [books, setBooks] = useState<SodamBook[]>([]);
  const [events, setEvents] = useState<SodamEvent[]>([]);
  const [dash, setDash] = useState<SodamDashboard | null>(null);
  // Mồi vô hiệu hoá dữ liệu cấp workspace (Panel #02 / C-1): mọi mutation đều
  // chốt qua reloadWorkspace → nonce tăng → mọi mặt đang mount nạp lại dữ
  // liệu riêng của mình, thay vì đứng hình cho tới khi người dùng chuyển mặt.
  const [dataNonce, setDataNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [ghosts, setGhosts] = useState<GhostEntry[]>([]);
  const [composerEventId, setComposerEventId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkJoinError, setLinkJoinError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const { online, enqueue, flush, pendingCount, flushFailed, bindBook, refreshPending } =
    useSodamOffline(api);
  const joinFromLinkTried = useRef(false);
  const toastId = useRef(0);
  const prevPending = useRef(0);
  const gPending = useRef<string | null>(null);

  const pushToast: PushToast = useCallback((message, action) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [
      ...prev.slice(-2),
      {
        id,
        message,
        actionLabel: action?.label,
        onAction: action
          ? () => {
              void action.run();
            }
          : undefined,
      },
    ]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshBooks = useCallback(async () => {
    try {
      const list = await api.listBooks(mode === 'mock' ? [] : knownBookCodes());
      setBooks(list);
      for (const b of list) rememberBook(b.id, b.inviteCode, b.name);
      setError(null);
    } catch (e) {
      if (navigator.onLine) setError(friendlyError(e, 'Lỗi tải sổ'));
    }
  }, [api, mode]);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  // Dữ liệu cấp workspace: dashboard (tổng + đám đang mở + số chờ trả) + danh sách đám.
  const reloadWorkspace = useCallback(async () => {
    if (!bookId) return;
    try {
      const [d, evs] = await Promise.all([api.dashboard(bookId), api.listEvents(bookId)]);
      setDash(d);
      setEvents(evs);
      setDataNonce((n) => n + 1);
      setActiveEventId((cur) => {
        if (cur && evs.some((e) => e.id === cur)) return cur;
        return d.openEvent?.id ?? evs[0]?.id ?? null;
      });
    } catch (e) {
      if (navigator.onLine) setError(friendlyError(e, 'Lỗi tải sổ'));
    }
  }, [api, bookId]);

  useEffect(() => {
    if (bookId) void reloadWorkspace();
  }, [bookId, reloadWorkspace]);

  // Share link (?code=XXXX): mở link là vào thẳng sổ; mã sai về bề mặt công khai kèm lỗi tại form join.
  useEffect(() => {
    if (joinFromLinkTried.current) return;
    joinFromLinkTried.current = true;
    const code = new URLSearchParams(window.location.search).get('code')?.trim();
    if (!code) return;
    void (async () => {
      try {
        const book = await api.joinBook(code);
        rememberBook(book.id, book.inviteCode, book.name);
        await refreshBooks();
        setBookId(book.id);
        setFace('overview');
      } catch {
        setLinkJoinError({
          code,
          message:
            'Không tìm thấy sổ với mã này — kiểm tra lại mã hoặc mở link chia sẻ là vào thẳng.',
        });
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.toString());
      }
    })();
  }, [api, refreshBooks]);

  const activeBook = books.find((b) => b.id === bookId) ?? null;

  useEffect(() => {
    if (bookId) bindBook(bookId);
  }, [bookId, bindBook]);

  useEffect(() => {
    if (online && bookId) void flush(bookId);
  }, [online, bookId, flush]);

  // Hàng chờ đã gửi hết: bỏ hàng ma trong phiên + báo đã gửi (khi đếm chuyển >0 → 0 trong phiên).
  useEffect(() => {
    if (prevPending.current > 0 && pendingCount === 0 && bookId) {
      setGhosts([]);
      pushToast(`Đã gửi ${prevPending.current} khoản đang chờ`);
      void reloadWorkspace();
    }
    prevPending.current = pendingCount;
  }, [pendingCount, bookId, pushToast, reloadWorkspace]);

  const openComposer = useCallback(
    (eventId?: string | null) => {
      const target = eventId ?? activeEventId ?? dash?.openEvent?.id ?? events[0]?.id ?? null;
      setComposerEventId(target);
      setComposerOpen(true);
    },
    [activeEventId, dash, events],
  );

  // Phím tắt desktop — chỉ trong workspace, không khi đang gõ.
  useEffect(() => {
    if (!bookId) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(target?.isContentEditable);
      if (e.key === '/' && !typing) {
        const el = document.getElementById('sodam-search');
        if (el) {
          e.preventDefault();
          el.focus();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (gPending.current === 'g') {
        gPending.current = null;
        if (e.key === 't') setFace('overview');
        else if (e.key === 'r') setFace('returns');
        else if (e.key === 'n') setFace('people');
        else if (e.key === 'h') setFace('tree');
        return;
      }
      if (e.key === 'g') {
        gPending.current = 'g';
        window.setTimeout(() => {
          gPending.current = null;
        }, 800);
        return;
      }
      if (e.key === 'n') openComposer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookId, openComposer]);

  const outboxChip =
    bookId && pendingCount > 0 ? (
      <OutboxChip
        count={pendingCount}
        failed={flushFailed}
        onRetry={() => void flush(bookId).then(() => refreshPending())}
      />
    ) : null;

  if (!bookId) {
    return (
      <>
        <HomeView
          api={api}
          books={books}
          online={online}
          linkJoinError={linkJoinError}
          onRetryBooks={() => void refreshBooks()}
          onCreate={async (name) => {
            try {
              const book = await api.createBook(name);
              rememberBook(book.id, book.inviteCode, book.name);
              await refreshBooks();
              setBookId(book.id);
              setFace('overview');
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
              rememberBook(book.id, book.inviteCode, book.name);
              await refreshBooks();
              setBookId(book.id);
              setFace('overview');
              return null;
            } catch {
              return 'Không tìm thấy sổ với mã này — kiểm tra lại mã hoặc mở link chia sẻ là vào thẳng.';
            }
          }}
          onOpen={(id) => {
            if (!online) {
              setError(
                'Cần có mạng để mở sổ này. Sổ của bạn vẫn an toàn trên hệ thống — mở lại khi có mạng là thấy tiếp.',
              );
              return;
            }
            setError(null);
            setBookId(id);
            setFace('overview');
          }}
          error={error}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const totals = dash?.totals;
  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;
  const composerEvent = events.find((e) => e.id === composerEventId) ?? null;
  const showSearch = face === 'event' || face === 'people';
  const searchPlaceholder =
    face === 'event' && activeEvent
      ? lexiconForKind(activeEvent.kind).searchPlaceholder
      : face === 'people'
        ? 'Tìm người…'
        : 'Tìm…';

  const shareMenu = activeBook ? (
    <span className="relative">
      <button
        type="button"
        onClick={() => {
          setShareOpen((v) => !v);
          setOverflowOpen(false);
        }}
        aria-expanded={shareOpen}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Chia sẻ
      </button>
      {shareOpen ? (
        <span className="absolute top-full right-0 z-30 mt-1 block w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-lift)]">
          <SharePanel
            api={api}
            book={activeBook}
            onClose={() => setShareOpen(false)}
            onRotated={(b) => {
              setBooks((prev) =>
                prev.map((x) => (x.id === b.id ? { ...x, inviteCode: b.inviteCode } : x)),
              );
            }}
            onToast={pushToast}
            onError={setError}
          />
        </span>
      ) : null}
    </span>
  ) : null;

  const overflowMenu = (
    <span className="relative">
      <button
        type="button"
        onClick={() => {
          setOverflowOpen((v) => !v);
          setShareOpen(false);
        }}
        aria-expanded={overflowOpen}
        aria-label="Thêm tuỳ chọn cho sổ"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <MoreVertical className="size-5" aria-hidden />
      </button>
      {overflowOpen ? (
        <span className="absolute top-full right-0 z-30 mt-1 block w-52 rounded-xl border border-line bg-card p-1.5 shadow-[var(--shadow-lift)]">
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            onClick={() => {
              setOverflowOpen(false);
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
                  setError(friendlyError(e, 'Xuất CSV lỗi'));
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
                setOverflowOpen(false);
                if (!file) return;
                void file.text().then(async (csv) => {
                  try {
                    await api.importCsv(bookId, csv);
                    await reloadWorkspace();
                  } catch (err) {
                    setError(friendlyError(err, 'Nhập CSV lỗi'));
                  }
                });
              }}
            />
          </label>
          {dash?.openEvent ? (
            <button
              type="button"
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => {
                setOverflowOpen(false);
                void api
                  .closeEvent(bookId, dash.openEvent!.id)
                  .then(() => reloadWorkspace())
                  .catch((err: Error) => setError(friendlyError(err, 'Đóng đám lỗi')));
              }}
            >
              Đóng đám đang ghi
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  return (
    <>
      <WorkspaceShell
        bookName={activeBook?.name ?? dash?.book.name ?? 'Sổ Đám'}
        inviteCode={activeBook?.inviteCode}
        online={online}
        error={error}
        books={books.map((b) => ({ id: b.id, name: b.name }))}
        events={events}
        activeBookId={bookId}
        activeEventId={activeEventId}
        face={face}
        returnsBadge={dash?.openReturnCount || undefined}
        onSelectBook={(id) => {
          setBookId(id);
          setFace('overview');
          setSearchQuery('');
        }}
        onSelectEvent={(id) => {
          setActiveEventId(id);
          setFace('event');
        }}
        onFace={(f) => setFace(f)}
        onHome={() => setBookId(null)}
        onCreateBook={() => setBookId(null)}
        onCreateEvent={() => setCreateEventOpen(true)}
        totalsStrip={
          totals ? (
            <TotalsStrip
              received={money(totals.receivedGrossVnd ?? totals.receivedVnd)}
              given={money(totals.givenVnd)}
              kept={money(totals.receivedVnd)}
              pendingLabel="Cần trả lễ"
              pendingValue={money(totals.pendingReturnVnd ?? 0)}
              pendingCount={dash?.openReturnCount ?? 0}
              overGiven={(totals.overGivenVnd ?? 0) > 0 ? money(totals.overGivenVnd!) : null}
            />
          ) : null
        }
        commandBar={
          <CommandBar
            onQuickEntry={() => openComposer()}
            showSearch={showSearch}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={searchPlaceholder}
            searchLabel={face === 'people' ? 'Tìm người' : 'Tìm trong bảng'}
            events={events}
            activeEventId={activeEventId}
            onSelectEvent={(id) => {
              setActiveEventId(id);
              setFace('event');
            }}
          />
        }
        outboxChip={outboxChip}
        shareMenu={shareMenu}
        overflowMenu={overflowMenu}
        mobileTotal={
          totals
            ? { label: 'Còn giữ', value: money(totals.receivedVnd) }
            : { label: 'Còn giữ', value: '—' }
        }
        quickBarAction={
          <Btn onClick={() => openComposer()}>
            <Plus className="size-4" aria-hidden /> Ghi khoản
          </Btn>
        }
      >
        <div
          key={`${face}-${activeEventId ?? ''}`}
          className="animate-face flex min-h-0 flex-1 flex-col"
        >
          {face === 'overview' ? (
            <OverviewFace
              api={api}
              bookId={bookId}
              dataNonce={dataNonce}
              events={events}
              openEventId={dash?.openEvent?.id ?? null}
              onOpenEvent={(id) => {
                setActiveEventId(id);
                setFace('event');
              }}
              onCreateEvent={() => setCreateEventOpen(true)}
              onSeeReturns={(eventId) => {
                setReturnsEventFilter(eventId);
                setFace('returns');
              }}
              onError={setError}
            />
          ) : null}

          {face === 'event' ? (
            activeEvent ? (
              <EventFace
                api={api}
                bookId={bookId}
                dataNonce={dataNonce}
                event={activeEvent}
                online={online}
                searchQuery={searchQuery}
                ghosts={ghosts.filter((g) => g.eventId === activeEvent.id)}
                onOpenComposer={() => openComposer(activeEvent.id)}
                onDataChanged={() => void reloadWorkspace()}
                onToast={pushToast}
                onError={setError}
              />
            ) : (
              <div className="p-4">
                <p className="text-sm text-muted">Chưa chọn đám nào.</p>
              </div>
            )
          ) : null}

          {face === 'returns' ? (
            <ReturnsFace
              api={api}
              bookId={bookId}
              dataNonce={dataNonce}
              events={events}
              eventFilter={returnsEventFilter}
              onClearEventFilter={() => setReturnsEventFilter(null)}
              onGoOverview={() => setFace('overview')}
              onDataChanged={() => void reloadWorkspace()}
              onToast={pushToast}
              onError={setError}
            />
          ) : null}

          {face === 'people' ? (
            <PeopleFace
              api={api}
              bookId={bookId}
              dataNonce={dataNonce}
              searchQuery={searchQuery}
              onOpenComposer={() => openComposer()}
              onError={setError}
            />
          ) : null}

          {face === 'tree' ? (
            <TreeFace
              api={api}
              bookId={bookId}
              dataNonce={dataNonce}
              contextKind={activeEvent?.kind ?? 'KHAC'}
              onToast={pushToast}
              onError={setError}
            />
          ) : null}
        </div>
      </WorkspaceShell>

      <CreateEventSheet
        open={createEventOpen}
        api={api}
        bookId={bookId}
        onClose={() => setCreateEventOpen(false)}
        onCreated={(ev, ghiNgay) => {
          setCreateEventOpen(false);
          setActiveEventId(ev.id);
          void reloadWorkspace();
          if (ghiNgay) openComposer(ev.id);
          else setFace('event');
        }}
        onError={setError}
      />

      {composerOpen ? (
        <QuickEntry
          api={api}
          bookId={bookId}
          events={events}
          initialEvent={composerEvent}
          online={online}
          enqueue={enqueue}
          onEnqueued={(g) => setGhosts((prev) => [...prev, g])}
          onClose={() => setComposerOpen(false)}
          onSaved={() => void reloadWorkspace()}
          onToast={pushToast}
          onCreateEvent={() => {
            setComposerOpen(false);
            setCreateEventOpen(true);
          }}
        />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

/** Hàng chép link trong menu chia sẻ — nút 44px có nhãn đầy đủ. */
/**
 * Panel chia sẻ sổ — DATA-04(ii) / UI-11 (re-grade r2): KHÔNG còn chép link
 * một chạm. Người dùng phải qua 2 lớp ngay tại điểm chia sẻ:
 *   Lớp 1 — xem trước (preview): thấy đúng link sẽ gửi + sổ nào sẽ mở,
 *           kèm cảnh báo hệ quả nguyên văn (ai có link cũng mở được toàn
 *           bộ sổ, không mật khẩu thêm).
 *   Lớp 2 — xác nhận "Tôi hiểu, hiện nút chép link" mới hiện nút chép.
 * Kèm lối thu hồi: đổi mã mời (mã cũ + mọi link đã gửi chết ngay) với xác
 * nhận hệ quả riêng — đây là đường xử lý khi link đã lỡ phát tán.
 */
function SharePanel({
  api,
  book,
  onClose,
  onRotated,
  onToast,
  onError,
}: {
  api: SodamApi;
  book: SodamBook;
  onClose: () => void;
  onRotated: (book: SodamBook) => void;
  onToast: PushToast;
  onError: (m: string | null) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [rotateStage, setRotateStage] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [justRotated, setJustRotated] = useState(false);
  const link = `${window.location.origin}/?code=${encodeURIComponent(book.inviteCode)}`;

  const doRotate = async () => {
    setRotateStage('busy');
    try {
      const next = await api.rotateInviteCode(book.id);
      onRotated(next);
      setRevealed(false);
      setRotateStage('idle');
      setJustRotated(true);
      onToast('Đã đổi mã mời — link cũ không còn mở được sổ này.');
    } catch (e) {
      setRotateStage('idle');
      onError(friendlyError(e, 'Chưa đổi được mã mời'));
    }
  };

  return (
    <span className="block">
      <span className="block text-sm font-medium text-ink">Chia sẻ sổ «{book.name}»</span>

      {justRotated ? (
        <span
          className="mt-2 block rounded-[10px] bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700"
          role="status"
        >
          Đã đổi mã mời. Mã mới{' '}
          <span className="font-mono font-semibold">{formatInviteCode(book.inviteCode)}</span> — chỉ
          thiết bị này biết; muốn chia sẻ tiếp phải qua cảnh báo dưới đây một lần nữa.
        </span>
      ) : null}

      {/* Lớp xem trước: đúng thứ người nhận sẽ bấm vào. */}
      <span className="mt-2 block rounded-[10px] border border-line bg-paper px-3 py-2.5">
        <span className="block text-xs text-muted">Link sẽ gửi đi</span>
        <span className="mt-0.5 block font-mono text-xs break-all text-ink">{link}</span>
        <span className="mt-1.5 block text-xs text-muted">
          Mã mời{' '}
          <span className="font-mono font-medium text-ink">
            {formatInviteCode(book.inviteCode)}
          </span>
        </span>
      </span>

      <span className="mt-2 block text-sm leading-relaxed text-muted">
        Ai có link này cũng mở được <strong className="font-semibold text-ink">toàn bộ sổ</strong> —
        xem hết mọi khoản, ghi thêm và sửa được, không cần mật khẩu nào nữa. Chỉ gửi cho người trong
        nhà, và đừng đăng link lên nơi công khai.
      </span>

      {!revealed ? (
        <span className="mt-3 flex gap-2">
          <Btn variant="secondary" onClick={onClose}>
            Quay lại
          </Btn>
          <Btn onClick={() => setRevealed(true)}>Tôi hiểu, hiện nút chép link</Btn>
        </span>
      ) : (
        <span className="mt-3 block">
          <InviteShareRow inviteCode={book.inviteCode} />
        </span>
      )}

      {/* Thu hồi: đổi mã mời. */}
      <span className="mt-3 block border-t border-line pt-3">
        {rotateStage === 'confirm' || rotateStage === 'busy' ? (
          <span className="block">
            <span className="block text-sm leading-relaxed text-muted">
              Đổi mã xong,{' '}
              <strong className="font-semibold text-ink">
                mã cũ và mọi link đã gửi sẽ không mở được sổ nữa
              </strong>
              . Thiết bị khác đang giữ mã cũ phải nhập mã mới; thiết bị này tự chuyển sang mã mới.
            </span>
            <span className="mt-2 flex gap-2">
              <Btn
                variant="secondary"
                disabled={rotateStage === 'busy'}
                onClick={() => setRotateStage('idle')}
              >
                Huỷ
              </Btn>
              <Btn disabled={rotateStage === 'busy'} onClick={() => void doRotate()}>
                {rotateStage === 'busy' ? 'Đang đổi…' : 'Đổi mã ngay'}
              </Btn>
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setRotateStage('confirm')}
            className="inline-flex min-h-11 items-center rounded-[10px] px-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Mã đã bị lộ? Đổi mã mời
          </button>
        )}
      </span>
    </span>
  );
}

function InviteShareRow({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  return (
    <span className="block">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-indigo-700 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        onClick={() => {
          const link = `${window.location.origin}/?code=${encodeURIComponent(inviteCode)}`;
          void (async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2500);
            } catch {
              setFallback(link);
            }
          })();
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : null}
        {copied ? 'Đã chép link' : 'Chép link chia sẻ'}
      </button>
      {fallback ? (
        <span className="mt-2 block font-mono text-xs break-all text-ink">{fallback}</span>
      ) : null}
    </span>
  );
}

function HomeView({
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      <span className="block truncate text-[15px] font-medium text-ink">
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

/* ------------------------------------------------------------------ */
/* Mặt Tổng quan: bảng đám + 5 khoản chờ trả lễ đầu.                   */
/* ------------------------------------------------------------------ */

function OverviewFace({
  api,
  bookId,
  dataNonce,
  events,
  openEventId,
  onOpenEvent,
  onCreateEvent,
  onSeeReturns,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  dataNonce: number;
  events: SodamEvent[];
  openEventId: string | null;
  onOpenEvent: (id: string) => void;
  onCreateEvent: () => void;
  onSeeReturns: (eventId: string | null) => void;
  onError: (m: string | null) => void;
}) {
  const [pending, setPending] = useState<SodamReturnItem[]>([]);

  useEffect(() => {
    void dataNonce;
    void api
      .listReturns(bookId, 'OPEN')
      .then(setPending)
      .catch((e: Error) => onError(friendlyError(e, 'Lỗi tải khoản chờ trả')));
  }, [api, bookId, onError, dataNonce]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
      <h2 className="sr-only">Tổng quan</h2>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[17px] font-semibold">Đám của sổ</h3>
        <Btn variant="secondary" onClick={onCreateEvent}>
          <Plus className="size-4" aria-hidden /> Tạo đám
        </Btn>
      </div>

      {events.length === 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-card">
          <EmptyLedger
            title="Chưa có đám nào"
            body="Tạo đám đầu tiên để bắt đầu ghi khoản cho nhà mình."
            action={
              <Btn onClick={onCreateEvent}>
                <Plus className="size-4" aria-hidden /> Tạo đám
              </Btn>
            }
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
          {events.map((e) => {
            const dates = eventDateLabels(e.occurredOn);
            const lex = lexiconForKind(e.kind);
            const isHosted = e.role === 'HOSTED';
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(e.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                >
                  <span
                    className={cn(
                      'shrink-0',
                      lex.group === 'solemn' || lex.group === 'memorial'
                        ? GROUP_STYLE[lex.group].accentText
                        : 'text-indigo-700',
                    )}
                  >
                    <KindIcon kind={e.kind} className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {e.id === openEventId ? '● ' : ''}
                      {e.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 truncate text-xs text-muted">
                      <span>
                        {kindLabel(e.kind)} · {isHosted ? 'Nhận lễ' : 'Đi đám'}
                        {dates ? ` · ${dates.solar}` : ''} · {e.entryCount ?? 0}{' '}
                        {lex.personLabel.toLowerCase()}
                      </span>
                      {dates?.lunar ? (
                        <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold-ink">
                          {dates.lunar}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                    {isHosted ? 'Nhận ' : 'Đi '}
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
            <h3 className="text-[17px] font-semibold">Chờ trả lễ</h3>
            <Btn variant="ghost" onClick={() => onSeeReturns(openEventId)}>
              Xem tất cả →
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet Tạo đám (§4): tên BẮT BUỘC, chip loại theo accent nhóm.       */
/* ------------------------------------------------------------------ */

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
        const style = GROUP_STYLE[groupOfKind(k)];
        return (
          <button
            key={k}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(k)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border px-2 text-center text-[13px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              active
                ? cn('font-semibold', style.selectedChip)
                : 'border-line-strong bg-card text-ink hover:bg-indigo-50',
            )}
          >
            <KindIcon kind={k} className="size-4 shrink-0" />
            {EVENT_KIND_LABELS[k] ?? kindLabel(k)}
          </button>
        );
      })}
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
  const [titleError, setTitleError] = useState<string | null>(null);
  const [kind, setKind] = useState<SodamEventKind>('CUOI');
  const [role, setRole] = useState<SodamEventRole>('HOSTED');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dates = eventDateLabels(date);

  const create = async (ghiNgay: boolean) => {
    if (!title.trim()) {
      setTitleError('Chưa nhập tên đám — gõ một tên để nhà mình dễ nhận ra.');
      titleRef.current?.focus();
      return;
    }
    setTitleError(null);
    setBusy(true);
    try {
      const ev = await api.createEvent(bookId, {
        title: title.trim(),
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
        <Field label="Tên đám" error={titleError}>
          <Input
            ref={titleRef}
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
              { id: 'HOSTED', label: 'Nhà mình tổ chức' },
              { id: 'ATTENDED', label: 'Nhà mình đi dự' },
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

/* ------------------------------------------------------------------ */
/* Composer ghi khoản phổ quát (§6): 2 mode Gõ tay | Giọng nói.       */
/* ------------------------------------------------------------------ */

function QuickEntry({
  api,
  bookId,
  events,
  initialEvent,
  online,
  enqueue,
  onEnqueued,
  onClose,
  onSaved,
  onToast,
  onCreateEvent,
}: {
  api: SodamApi;
  bookId: string;
  events: SodamEvent[];
  initialEvent: SodamEvent | null;
  online: boolean;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  onEnqueued: (ghost: GhostEntry) => void;
  onClose: () => void;
  onSaved: () => void;
  onToast: PushToast;
  onCreateEvent: () => void;
}) {
  const [event, setEvent] = useState<SodamEvent | null>(initialEvent);
  const lex = event ? lexiconForKind(event.kind) : null;
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
    if (!event || !lex) return;
    let ok = true;
    if (!name.trim()) {
      setNameError('Chưa nhập tên — gõ tên hoặc chọn một người bên dưới.');
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
        onEnqueued({
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
      onToast(lex.savedToast(name.trim()));
      onSaved();
      onClose();
    } catch (e) {
      setAmountError(friendlyError(e, 'Chưa lưu được khoản — thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const title = event && lex ? `${lex.entryVerb} — ${event.title}` : 'Ghi khoản';

  return (
    <Sheet open title={title} onClose={onClose}>
      {queuedNote ? (
        <div className="space-y-4">
          <p role="status" className="rounded-[10px] bg-indigo-50 px-3 py-3 text-sm font-medium">
            Đã lưu vào hàng chờ trên máy này — sẽ tự gửi khi có mạng.
          </p>
          <Btn className="w-full" onClick={onClose}>
            Xong
          </Btn>
        </div>
      ) : !event ? (
        <div className="space-y-3">
          {events.length === 0 ? (
            <>
              <p className="text-sm text-muted">
                Sổ chưa có đám nào — tạo đám trước rồi ghi khoản vào đám đó.
              </p>
              <Btn className="w-full" onClick={onCreateEvent}>
                <Plus className="size-4" aria-hidden /> Tạo đám
              </Btn>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Chọn đám để ghi khoản</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {events.map((e) => {
                  const style = GROUP_STYLE[groupOfKind(e.kind)];
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEvent(e)}
                        className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                      >
                        <span className={cn('shrink-0', style.accentText)}>
                          <KindIcon kind={e.kind} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                        <span className="shrink-0 text-xs text-muted">{kindLabel(e.kind)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Btn variant="secondary" className="w-full" onClick={onCreateEvent}>
                <Plus className="size-4" aria-hidden /> Tạo đám mới
              </Btn>
            </>
          )}
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
                <Mic className="size-4" aria-hidden />
                {listening ? 'Dừng nghe' : 'Bấm để nói'}
              </Btn>
              <p className="text-sm text-muted">
                Ghi miệng trước, sửa sau. Tiền chỉ lưu khi bạn bấm Lưu.
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
              {voiceNote?.includes('không hỗ trợ') ? (
                <Btn variant="secondary" onClick={() => setMode('manual')}>
                  Chuyển sang Gõ tay
                </Btn>
              ) : null}
            </div>
          ) : null}

          <Field label={lex!.nameFieldLabel} error={nameError}>
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

          <Field label={lex!.amountFieldLabel} error={amountError}>
            <Input
              ref={amountRef}
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0 ₫"
            />
          </Field>
          <QuickAmounts onPick={(v) => setAmount(String(v))} />

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 text-sm text-muted" aria-live="polite">
              {name.trim() && amountNum > 0 ? (
                <>
                  Sẽ ghi: <span className="font-medium text-ink">{name.trim()}</span> —{' '}
                  <span className="font-mono font-semibold text-ink">{money(amountNum)}</span>
                  {lex!.reviewNoun ? ` ${lex!.reviewNoun}` : ''}
                </>
              ) : (
                'Sẽ ghi: …'
              )}
            </p>
            <Btn disabled={busy} onClick={() => void save()} className="shrink-0">
              {lex!.saveLabel}
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

/* ------------------------------------------------------------------ */
/* Mặt Đám: dải meta theo giọng + dải tổng + bảng khoản cuộn nội bộ.  */
/* ------------------------------------------------------------------ */

function EventFace({
  api,
  bookId,
  dataNonce,
  event,
  online,
  searchQuery,
  ghosts,
  onOpenComposer,
  onDataChanged,
  onToast,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  dataNonce: number;
  event: SodamEvent;
  online: boolean;
  searchQuery: string;
  ghosts: GhostEntry[];
  onOpenComposer: () => void;
  onDataChanged: () => void;
  onToast: PushToast;
  onError: (m: string | null) => void;
}) {
  const [detail, setDetail] = useState<(SodamEvent & { entries: SodamEntry[] }) | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setDetail(await api.getEvent(bookId, event.id));
    } catch (e) {
      onError(friendlyError(e, 'Lỗi tải đám'));
    }
  }, [api, bookId, event.id, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // C-1 (Panel #02): mutation từ composer ở tầng workspace (vd ghi khoản mới)
  // chỉ gọi reloadWorkspace — detail của mặt đang mount phải nạp lại theo
  // nonce, nếu không bảng + tổng đám đứng hình cả phiên tới khi reload cứng.
  const seenNonce = useRef(dataNonce);
  useEffect(() => {
    if (seenNonce.current !== dataNonce) {
      seenNonce.current = dataNonce;
      void reload();
    }
  }, [dataNonce, reload]);

  const lex = lexiconForKind(event.kind);
  const group = lex.group;
  const solemnLike = group === 'solemn' || group === 'memorial';
  const style = GROUP_STYLE[group];
  const isHosted = event.role === 'HOSTED';
  const gross = detail?.totalAmountVnd ?? event.totalAmountVnd ?? 0;
  const settled = detail?.settledVnd ?? event.settledVnd ?? 0;
  const net = detail?.netTotalVnd ?? event.netTotalVnd ?? Math.max(0, gross - settled);
  const dates = eventDateLabels(event.occurredOn);
  const q = searchQuery.trim().toLowerCase();
  const shownEntries = (detail?.entries ?? []).filter(
    (e) => !q || e.personName.toLowerCase().includes(q),
  );
  const shownGhosts = ghosts.filter((g) => !q || g.personName.toLowerCase().includes(q));

  const totalCells = isHosted
    ? [
        { label: lex.totalLabel, value: gross },
        { label: 'Còn giữ', value: net },
        {
          label: lex.paidLabel === 'đã đi lại' ? 'Đã đi lại' : 'Đã trả',
          value: settled,
        },
      ]
    : [{ label: 'Tổng đã đưa', value: gross }];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('px-4 py-3 lg:px-5', style.softBg)}>
        <h2
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold',
            style.accentText,
          )}
        >
          <KindIcon kind={event.kind} className="size-5 shrink-0" />
          <span>
            {kindLabel(event.kind)} · {isHosted ? 'Nhận lễ' : 'Đi đám'} ·{' '}
            {detail?.entryCount ?? event.entryCount ?? 0} {lex.personLabel.toLowerCase()}
          </span>
          {dates ? <span className="font-normal">· {dates.solar}</span> : null}
          {dates?.lunar ? (
            <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold-ink">
              {dates.lunar}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 truncate text-lg font-semibold text-ink">{event.title}</p>
      </div>

      <div className="flex divide-x divide-line border-b border-line bg-card">
        {totalCells.map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-4 py-2.5 lg:px-5">
            <p className="truncate text-xs text-muted">{cell.label}</p>
            <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tabular-nums">
              {money(cell.value)}
            </p>
          </div>
        ))}
      </div>
      {ghosts.length > 0 ? (
        <p
          role="status"
          className="border-b border-line bg-indigo-50 px-4 py-2 text-sm text-indigo-700 lg:px-5"
        >
          Chưa gồm {ghosts.length} khoản đang chờ gửi.
        </p>
      ) : null}

      <section aria-label="Sổ khoản" className="flex min-h-0 flex-1 flex-col bg-card">
        <div
          className="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-3.5 py-2 text-sm font-medium text-muted sm:grid-cols-[1fr_8rem_auto]"
          aria-hidden
        >
          <span>{lex.personLabel}</span>
          <span className="text-right">Số tiền</span>
          <span className="hidden sm:block">Trả lễ</span>
        </div>

        {!detail ? (
          <p className="px-4 py-4 text-sm text-muted">Đang tải đám…</p>
        ) : detail.entries.length === 0 && ghosts.length === 0 ? (
          <div className="overflow-y-auto">
            <EmptyLedger
              title={lex.emptyTitle}
              body={lex.emptyBody}
              action={
                <Btn onClick={onOpenComposer}>
                  <Plus className="size-4" aria-hidden /> Ghi khoản
                </Btn>
              }
            />
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {shownGhosts.map((g, i) => (
              <li key={`ghost-${i}`} className="flex min-h-[52px] items-center gap-3 px-3.5 py-2.5">
                <PersonAvatar name={g.personName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">
                    {g.personName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {sourceLabel(g.source)} · đang chờ gửi
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-ink">
                  {money(g.amountVnd)}
                </span>
                <StatusPill status="PENDING" />
              </li>
            ))}
            {shownEntries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
                  aria-expanded={expandedId === e.id}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                >
                  <PersonAvatar name={e.personName} seed={e.personId ?? undefined} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {e.personName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {sourceLabel(e.source)} · {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {money(e.amountVnd)}
                  </span>
                  {isHosted && e.returnItem ? (
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
                  ) : null}
                </button>
                {expandedId === e.id ? (
                  <EntryExpand
                    api={api}
                    bookId={bookId}
                    event={event}
                    entry={e}
                    online={online}
                    fadeOnly={solemnLike}
                    onDone={() => {
                      void reload();
                      onDataChanged();
                    }}
                    onToast={onToast}
                    onError={onError}
                  />
                ) : null}
              </li>
            ))}
            {shownEntries.length === 0 && shownGhosts.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted">
                Không thấy khoản nào khớp với từ tìm.
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Phần mở rộng trong hàng sổ: trả lễ (câu hệ quả theo tình huống) + sửa + xoá khoản, đều có hoàn tác qua toast. */
function EntryExpand({
  api,
  bookId,
  event,
  entry,
  online,
  fadeOnly,
  onDone,
  onToast,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  event: SodamEvent;
  entry: SodamEntry;
  online: boolean;
  fadeOnly: boolean;
  onDone: () => void;
  onToast: PushToast;
  onError: (m: string | null) => void;
}) {
  const lex = lexiconForKind(event.kind);
  const ret = entry.returnItem;
  const received = ret?.receivedAmountVnd ?? entry.amountVnd;
  const [pay, setPay] = useState(String(received));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(entry.personName);
  const [editAmount, setEditAmount] = useState(String(entry.amountVnd));
  const [editNote, setEditNote] = useState(entry.note ?? '');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editAmountError, setEditAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payNum = Number(pay.replace(/\D/g, '')) || 0;
  const editAmountNum = Number(editAmount.replace(/\D/g, '')) || 0;

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

  const undoReturn = async (returnId: string) => {
    try {
      await api.markReturn(bookId, returnId, { status: 'OPEN' });
      onDone();
    } catch (e) {
      onError(friendlyError(e, 'Chưa hoàn tác được'));
    }
  };

  return (
    <div
      className={cn(
        'border-t border-line bg-paper px-3.5 py-3.5',
        fadeOnly ? 'animate-face' : 'animate-row',
      )}
    >
      {!online ? (
        <p
          role="status"
          className="mb-3 rounded-[10px] bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700"
        >
          Đang offline — sửa và xoá cần có mạng. Ghi khoản mới vẫn được, sẽ vào hàng chờ.
        </p>
      ) : null}

      {event.role === 'HOSTED' && ret ? (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">Trả lễ</p>
          {ret.status === 'OPEN' ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Số tiền trả lễ">
                  <Input
                    inputMode="numeric"
                    value={formatAmountInput(pay)}
                    onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))}
                    aria-label={`Số tiền trả lễ cho ${entry.personName}`}
                    disabled={!online}
                  />
                </Field>
                <Btn
                  disabled={payNum <= 0 || busy || !online}
                  onClick={() =>
                    void run(async () => {
                      await api.markReturn(bookId, ret.id, {
                        status: 'DONE',
                        amountVnd: payNum,
                      });
                      onToast(`Đã đánh dấu đã trả cho ${entry.personName}.`, {
                        label: 'Hoàn tác',
                        run: () => undoReturn(ret.id),
                      });
                    }, 'Chưa ghi được trả lễ')
                  }
                >
                  Xác nhận đã trả
                </Btn>
              </div>
              <div className="mt-2">
                <QuickAmounts onPick={(v) => setPay(String(v))} />
              </div>
              {payNum > 0 ? (
                <p className="mt-2 text-sm text-muted" aria-live="polite">
                  {returnConsequence(payNum, received, entry.personName)}
                </p>
              ) : null}
              <div className="mt-2">
                <Btn
                  variant="ghost"
                  disabled={busy || !online}
                  onClick={() =>
                    void run(async () => {
                      await api.markReturn(bookId, ret.id, { status: 'SKIPPED' });
                      onToast(`Đã bỏ qua khoản trả lễ cho ${entry.personName}.`, {
                        label: 'Hoàn tác',
                        run: () => undoReturn(ret.id),
                      });
                    }, 'Chưa bỏ qua được')
                  }
                >
                  Bỏ qua khoản trả lễ này
                </Btn>
              </div>
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
                    <span className="font-mono font-semibold text-ink">
                      {money(ret.overGivenVnd!)}
                    </span>
                  </>
                ) : null}
              </p>
              <Btn
                variant="secondary"
                disabled={busy || !online}
                onClick={() =>
                  void run(
                    () => api.markReturn(bookId, ret.id, { status: 'OPEN' }),
                    'Chưa hoàn tác được',
                  )
                }
              >
                <Undo2 className="size-4" aria-hidden /> Hoàn tác
              </Btn>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">Đã bỏ qua trả lễ cho khoản này.</p>
              <Btn
                variant="secondary"
                disabled={busy || !online}
                onClick={() =>
                  void run(
                    () => api.markReturn(bookId, ret.id, { status: 'OPEN' }),
                    'Chưa mở lại được',
                  )
                }
              >
                <Undo2 className="size-4" aria-hidden /> Mở lại
              </Btn>
            </div>
          )}
        </div>
      ) : null}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" disabled={!online} onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> Sửa khoản
          </Btn>
          <Btn
            variant="ghost"
            className="text-lacquer hover:bg-lacquer/5"
            disabled={!online}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden /> Xoá khoản
          </Btn>
        </div>
      ) : (
        <div>
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr] sm:items-start">
            <Field label={lex.nameFieldLabel} error={editNameError}>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>
            <Field label={lex.amountFieldLabel} error={editAmountError}>
              <Input
                inputMode="numeric"
                value={formatAmountInput(editAmount)}
                onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Ghi chú">
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </Field>
          </div>
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            {editName.trim() && editAmountNum > 0
              ? `Sẽ sửa thành: ${editName.trim()} — ${money(editAmountNum)}`
              : 'Sẽ sửa thành: …'}
          </p>
          <div className="mt-2.5 flex gap-2">
            <Btn
              disabled={busy}
              onClick={() => {
                let ok = true;
                if (!editName.trim()) {
                  setEditNameError('Chưa nhập tên — gõ tên hoặc chọn một người bên dưới.');
                  ok = false;
                } else setEditNameError(null);
                if (editAmountNum <= 0) {
                  setEditAmountError('Chưa nhập số tiền — chạm một mức bên dưới hoặc gõ số tiền.');
                  ok = false;
                } else setEditAmountError(null);
                if (!ok) return;
                const before = {
                  personName: entry.personName,
                  amountVnd: entry.amountVnd,
                  note: entry.note ?? '',
                };
                void run(async () => {
                  await api.updateEntry(bookId, event.id, entry.id, {
                    personName: editName.trim(),
                    amountVnd: editAmountNum,
                    note: editNote,
                  });
                  onToast(`Đã sửa khoản của ${editName.trim()}.`, {
                    label: 'Hoàn tác',
                    run: async () => {
                      await api.updateEntry(bookId, event.id, entry.id, before);
                      onDone();
                    },
                  });
                }, 'Chưa sửa được khoản');
              }}
            >
              Lưu sửa
            </Btn>
            <Btn variant="secondary" onClick={() => setEditing(false)}>
              Huỷ
            </Btn>
          </div>
        </div>
      )}

      {confirmDelete ? (
        <div
          role="group"
          aria-label="Xác nhận xoá khoản"
          className="mt-3 rounded-[10px] border border-lacquer bg-card px-3 py-3"
        >
          <p className="text-sm">
            Xoá khoản <span className="font-mono font-semibold">{money(entry.amountVnd)}</span> của{' '}
            {entry.personName}? Khoản trả lễ gắn với khoản này cũng bị huỷ.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Btn
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const original = {
                    personName: entry.personName,
                    amountVnd: entry.amountVnd,
                    source: entry.source,
                    note: entry.note ?? undefined,
                  };
                  await api.deleteEntry(bookId, event.id, entry.id);
                  onToast(`Đã xoá khoản của ${entry.personName}.`, {
                    label: 'Hoàn tác',
                    run: async () => {
                      await api.createEntry(bookId, event.id, original);
                      onDone();
                    },
                  });
                }, 'Chưa xoá được khoản')
              }
            >
              Xoá khoản
            </Btn>
            <Btn variant="secondary" onClick={() => setConfirmDelete(false)}>
              Giữ lại
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mặt Trả lễ: dải tổng mini + lọc 4 mục + hàng mở cùng câu hệ quả.   */
/* ------------------------------------------------------------------ */

function ReturnsFace({
  api,
  bookId,
  dataNonce,
  events,
  eventFilter,
  onClearEventFilter,
  onGoOverview,
  onDataChanged,
  onToast,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  dataNonce: number;
  events: SodamEvent[];
  eventFilter: string | null;
  onClearEventFilter: () => void;
  onGoOverview: () => void;
  onDataChanged: () => void;
  onToast: PushToast;
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

  // C-1: nạp lại khi workspace báo dữ liệu đổi (nonce) — xem EventFace.
  const seenNonce = useRef(dataNonce);
  useEffect(() => {
    if (seenNonce.current !== dataNonce) {
      seenNonce.current = dataNonce;
      void reload();
    }
  }, [dataNonce, reload]);

  if (!all) return <p className="p-4 text-sm text-muted">Đang tải danh sách trả lễ…</p>;

  const receivedOf = (r: SodamReturnItem) => r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0;
  const scoped = eventFilter ? all.filter((r) => r.fromEventId === eventFilter) : all;
  const open = scoped.filter((r) => r.status === 'OPEN');
  const done = scoped.filter((r) => r.status === 'DONE');
  const skipped = scoped.filter((r) => r.status === 'SKIPPED');
  const over = done.filter((r) => (r.overGivenVnd ?? 0) > 0);
  const shown =
    filter === 'OPEN' ? open : filter === 'DONE' ? done : filter === 'SKIPPED' ? skipped : over;
  const filterEvent = events.find((e) => e.id === eventFilter) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
      <h2 className="sr-only">Trả lễ</h2>
      <div className="flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-card">
        {[
          { label: 'Chờ trả', value: open.reduce((s, r) => s + receivedOf(r), 0) },
          {
            label: 'Đã trả',
            value: done.reduce((s, r) => s + (r.returnedAmountVnd ?? r.doneAmountVnd ?? 0), 0),
          },
          { label: 'Trả dư', value: over.reduce((s, r) => s + (r.overGivenVnd ?? 0), 0) },
        ].map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-3.5 py-3">
            <p className="text-xs text-muted">{cell.label}</p>
            <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tabular-nums">
              {money(cell.value)}
            </p>
          </div>
        ))}
      </div>

      {filterEvent ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>
            Đang xem: <span className="font-medium">{filterEvent.title}</span>
          </span>
          <Btn variant="ghost" onClick={onClearEventFilter}>
            Bỏ lọc
          </Btn>
        </p>
      ) : null}

      <div className="mt-4">
        <SegmentedTabs
          ariaLabel="Lọc khoản trả lễ"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'OPEN', label: `Chờ trả (${open.length})` },
            { id: 'DONE', label: 'Đã trả' },
            { id: 'SKIPPED', label: 'Bỏ qua' },
            { id: 'OVER', label: 'Trả dư' },
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
                  ? 'Chưa có khoản trả dư'
                  : filter === 'SKIPPED'
                    ? 'Chưa có khoản bỏ qua'
                    : 'Chưa có khoản đã trả'
            }
            body={
              filter === 'OPEN'
                ? 'Khi có khách đã ghi khoản trong đám nhà mình tổ chức, khoản cần trả sẽ hiện ở đây.'
                : 'Các khoản đã xử lý sẽ hiện ở đây để nhà mình đối chiếu.'
            }
            action={
              <Btn variant="secondary" onClick={onGoOverview}>
                Về Tổng quan
              </Btn>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
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
                    onDone={() => {
                      void reload();
                      onDataChanged();
                    }}
                    onToast={onToast}
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
  onToast,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  item: SodamReturnItem;
  onDone: () => void;
  onToast: PushToast;
  onError: (m: string | null) => void;
}) {
  const received = item.receivedAmountVnd ?? item.suggestedAmountVnd ?? 0;
  const [pay, setPay] = useState(String(received));
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

  const undoToOpen = async () => {
    try {
      await api.markReturn(bookId, item.id, { status: 'OPEN' });
      onDone();
    } catch (e) {
      onError(friendlyError(e, 'Chưa hoàn tác được'));
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
                  <span className="font-mono font-semibold text-ink">
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
            void run(() => api.markReturn(bookId, item.id, { status: 'OPEN' }), 'Chưa mở lại được')
          }
        >
          <Undo2 className="size-4" aria-hidden /> Mở lại khoản
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
        <Btn
          disabled={payNum <= 0 || busy}
          onClick={() =>
            void run(async () => {
              await api.markReturn(bookId, item.id, { status: 'DONE', amountVnd: payNum });
              onToast(`Đã đánh dấu đã trả cho ${name}.`, {
                label: 'Hoàn tác',
                run: undoToOpen,
              });
            }, 'Chưa ghi được trả lễ')
          }
        >
          Xác nhận đã trả
        </Btn>
        <Btn
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.markReturn(bookId, item.id, { status: 'SKIPPED' });
              onToast(`Đã bỏ qua khoản trả lễ cho ${name}.`, {
                label: 'Hoàn tác',
                run: undoToOpen,
              });
            }, 'Chưa bỏ qua được')
          }
        >
          Bỏ qua
        </Btn>
      </div>
      <div className="mt-2">
        <QuickAmounts onPick={(v) => setPay(String(v))} />
      </div>
      {payNum > 0 ? (
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {returnConsequence(payNum, received, name)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Họ đã ghi <span className="font-mono font-medium text-ink">{money(received)}</span> — số
          trả mặc định bằng số đã nhận, sửa được trước khi xác nhận.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mặt Người: tổng hợp qua lại + đám gần nhất + sheet chi tiết.       */
/* ------------------------------------------------------------------ */

type PersonAggregate = {
  person: SodamPerson;
  received: number;
  given: number;
  latestEventTitle: string | null;
  history: Array<{ entry: SodamEntry; eventTitle: string; role: SodamEventRole }>;
};

function PeopleFace({
  api,
  bookId,
  dataNonce,
  searchQuery,
  onOpenComposer,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  dataNonce: number;
  searchQuery: string;
  onOpenComposer: () => void;
  onError: (m: string | null) => void;
}) {
  const [rows, setRows] = useState<PersonAggregate[] | null>(null);
  const [selected, setSelected] = useState<PersonAggregate | null>(null);

  useEffect(() => {
    void dataNonce;
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
          map.set(p.id, { person: p, received: 0, given: 0, latestEventTitle: null, history: [] });
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
                latestEventTitle: null,
                history: [],
              };
              map.set(key, agg);
            }
            if (detail.role === 'HOSTED') agg.received += entry.amountVnd;
            else agg.given += entry.amountVnd;
            agg.history.push({ entry, eventTitle: detail.title, role: detail.role });
          }
        }
        for (const agg of map.values()) {
          const sorted = [...agg.history].sort((a, b) =>
            b.entry.createdAt.localeCompare(a.entry.createdAt),
          );
          agg.latestEventTitle = sorted[0]?.eventTitle ?? null;
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
  }, [api, bookId, onError, dataNonce]);

  const q = searchQuery.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => !q || r.person.displayName.toLowerCase().includes(q));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
      <h2 className="sr-only">Người</h2>
      {rows === null ? (
        <p className="text-sm text-muted">Đang tải danh sách người…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-line bg-card">
          <EmptyLedger
            title={q ? 'Không thấy người này' : 'Chưa có ai trong sổ'}
            body={
              q
                ? 'Thử gõ tên khác, hoặc người này chưa được ghi khoản nào.'
                : 'Ghi khoản đầu tiên — người được ghi sẽ hiện ở đây.'
            }
            action={
              !q ? (
                <Btn onClick={onOpenComposer}>
                  <Plus className="size-4" aria-hidden /> Ghi khoản
                </Btn>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
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
                    {r.latestEventTitle ? ` · Đám gần nhất: ${r.latestEventTitle}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[13px] font-medium tabular-nums">
                    +{money(r.received)}
                  </span>
                  <span className="block font-mono text-[13px] font-medium tabular-nums text-ink">
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
              Đối lưu: nhận{' '}
              <span className="font-mono font-semibold text-ink">{money(selected.received)}</span>
              {' · đi '}
              <span className="font-mono font-semibold text-ink">{money(selected.given)}</span>
              {selected.received - selected.given !== 0 ? (
                <>
                  {' · chênh '}
                  <span className="font-mono font-semibold text-ink">
                    {money(selected.received - selected.given)}
                  </span>
                </>
              ) : null}
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

/* ------------------------------------------------------------------ */
/* Mặt Cây họ: khung cuộn 2 chiều + gắn/xoá quan hệ (xoá có hoàn tác).*/
/* ------------------------------------------------------------------ */

const RELATION_LABELS: Record<SodamRelationType, string> = {
  SPOUSE: 'Vợ/Chồng',
  PARENT: 'Cha/Mẹ',
  CHILD: 'Con',
  SIBLING: 'Anh/Chị/Em',
  OTHER: 'Họ hàng',
};

function TreeFace({
  api,
  bookId,
  dataNonce,
  contextKind,
  onToast,
  onError,
}: {
  api: SodamApi;
  bookId: string;
  dataNonce: number;
  contextKind: SodamEventKind;
  onToast: PushToast;
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

  const contextGroup = groupOfKind(contextKind);
  const relationOrder = relationOrderForGroup(contextGroup);

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

  // C-1: nạp lại khi workspace báo dữ liệu đổi (nonce) — xem EventFace.
  const seenNonce = useRef(dataNonce);
  useEffect(() => {
    if (seenNonce.current !== dataNonce) {
      seenNonce.current = dataNonce;
      void reload();
    }
  }, [dataNonce, reload]);

  if (people === null) {
    return <p className="p-4 text-sm text-muted">Đang tải cây họ…</p>;
  }

  const nameOf = (id: string) => people.find((p) => p.id === id)?.displayName ?? id;

  const removeRelation = async (relation: SodamRelation) => {
    setRelBusy(true);
    try {
      await api.deleteRelation(bookId, relation.id);
      setConfirmRelId(null);
      await reload();
      onToast(
        `Đã xoá quan hệ giữa ${nameOf(relation.fromPersonId)} và ${nameOf(relation.toPersonId)}.`,
        {
          label: 'Hoàn tác',
          run: async () => {
            await api.createRelation(bookId, {
              fromPersonId: relation.fromPersonId,
              toPersonId: relation.toPersonId,
              type: relation.type,
            });
            await reload();
          },
        },
      );
    } catch (e) {
      onError(friendlyError(e, 'Chưa xoá được quan hệ'));
    } finally {
      setRelBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
      <h2 className="sr-only">Cây họ</h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {people.length} người · {relations.length} quan hệ đã gắn
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setListOpen(true)}>
            Quan hệ đã gắn
          </Btn>
          <Btn disabled={people.length < 2} onClick={() => setAttachOpen(true)}>
            <Plus className="size-4" aria-hidden /> Gắn quan hệ
          </Btn>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-card">
          <EmptyLedger
            title="Chưa có ai trong sổ"
            body="Ghi khoản đầu tiên — mỗi người được ghi sẽ hiện ở đây để gắn quan hệ."
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
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                {people.length >= 2
                  ? 'Chưa gắn quan hệ nào. Gắn quan hệ để các khoản qua lại tự xếp theo từng nhánh họ.'
                  : 'Cần ít nhất hai người mới gắn được quan hệ — ghi khoản cho thêm một người nữa là gắn được.'}
              </p>
              {people.length >= 2 ? (
                <Btn variant="secondary" onClick={() => setAttachOpen(true)}>
                  <Plus className="size-4" aria-hidden /> Gắn quan hệ đầu tiên
                </Btn>
              ) : null}
            </div>
          )}
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
              {relationOrder.map((k) => (
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
                    <Trash2 className="size-4" aria-hidden />
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
                        onClick={() => void removeRelation(r)}
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
