'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSodamApi, resolveSodamApiMode } from './api';
import type { SodamBook, SodamDashboard, SodamEvent } from './api/types';
import { knownBookCodes, rememberBook } from './lib/book-store';
import { totalsTerms } from './lib/totals-strip';
import { useSodamOffline } from './lib/offline';
import { groupOfKind, lexiconForKind } from './lib/lexicon';
import { startRum } from './lib/rum';
import { Btn, CommandBar, Sheet, TotalsStrip, WorkspaceShell } from './shell';
import { OutboxChip } from './ui/offline-ui';
import { ToastStack, type ToastData } from './ui/toast';
import { MoreVertical, Plus } from 'lucide-react';
import { friendlyError, money, type Face, type GhostEntry, type PushToast } from './app-shared';
import { SharePanel } from './panels/share-panel';
import { CreateEventSheet } from './panels/create-event-sheet';
import { QuickEntry } from './panels/quick-entry';
import { HomeView } from './faces/home-view';
import { OverviewFace } from './faces/overview-face';
import { EventFace } from './faces/event-face';
import { ReturnsFace } from './faces/returns-face';
import { PeopleFace } from './faces/people-face';
import { TreeFace } from './faces/tree-face';

export function SodamApp() {
  // PERF-12: RUM console-only — mount đúng 1 lần ở component gốc, dừng khi
  // unmount. startRum tự guard typeof window/PerformanceObserver.
  useEffect(() => startRum() ?? undefined, []);
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
  const activeEventGroup = activeEvent ? groupOfKind(activeEvent.kind) : null;
  // F7 (Panel R1): suppression CHỈ trong bề mặt chi tiết của chính đám
  // tang/giỗ (mặt Đám đang mở đúng đám đó). Ở mọi mặt cấp sổ khác
  // (Tổng quan / Trả lễ / Người / Cây họ) chrome giữ accent thường dù
  // đám đang chọn trong ô ghi khoản là đám tang.
  const suppressAccent =
    face === 'event' && (activeEventGroup === 'solemn' || activeEventGroup === 'memorial');
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
          setShareOpen(true);
          setOverflowOpen(false);
        }}
        aria-expanded={shareOpen}
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-[7px] px-2.5 text-sm font-medium transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
          // F7′ (Recheck R2): «Chia sẻ» là chrome của VIEW đang xem —
          // ở mặt chi tiết đám tang/giỗ nó về mực trung tính theo
          // suppression của chính view đó; ở mọi mặt khác giữ accent.
          (suppressAccent ? 'text-ink' : 'text-indigo-700')
        }
      >
        Chia sẻ
      </button>
      {/* F6 (Panel R1): panel chia sẻ là SHEET có scrim đều toàn màn
          (Sheet lo scrim bg-ink/45 phủ kín) — hết cảnh panel lơ lửng hở
          mép, nền lòi chữ cụt quanh panel như dropdown cũ. */}
      {shareOpen ? (
        <Sheet open title={`Chia sẻ sổ`} onClose={() => setShareOpen(false)}>
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
        </Sheet>
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
        suppressChromeAccent={suppressAccent}
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
          // F10 (Panel R1): cắt khối tổng toàn sổ khỏi mặt Người và Cây
          // họ — ở đó nó là nghi lễ lặp, không phục vụ việc đang làm.
          // Giữ ở Tổng quan / Đám / Trả lễ. F3: ở mặt chi tiết đám
          // tang/giỗ, ẩn hàng «Cần trả lễ» (hidePending).
          face === 'people' || face === 'tree' ? null : totals ? (
            <TotalsStrip
              hidePending={suppressAccent}
              hideTerms={suppressAccent}
              received={money(totals.receivedGrossVnd ?? totals.receivedVnd)}
              given={money(totals.givenVnd)}
              kept={money(totals.receivedVnd)}
              pendingLabel="Cần trả lễ"
              pendingValue={money(totals.pendingReturnVnd ?? 0)}
              pendingCount={dash?.openReturnCount ?? 0}
              terms={totalsTerms(totals).map((t) => ({ label: t.label, value: money(t.valueVnd) }))}
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
