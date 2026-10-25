'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSodamApi, resolveSodamApiMode } from './api';
import type { SodamBook, SodamDashboard, SodamEvent } from './api/types';
import {
  clearLastBook,
  knownBooks,
  knownBookCodes,
  lastBookId,
  rememberBook,
  rememberLastBook,
} from './lib/book-store';
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

/* ------------------------------------------------------------------ */
/* W3 (PWA-FIX 6.5, PWA-33): history lớp cho SPA một URL «/».         */
/*                                                                    */
/* Sơ đồ lớp (dưới → trên):                                           */
/*   [entry trình duyệt trước app] → landing → book → sheet (tối đa   */
/*   1 sheet tại một thời điểm trong app.tsx)                         */
/*                                                                    */
/* - landing: entry đầu tiên khi app nạp — replaceState gắn nhãn,    */
/*   không đẩy entry mới, nên Back ở landing rời app như bình thường. */
/* - book: pushState khi vào sổ (null → có bookId).                   */
/* - sheet: pushState khi một sheet mở (composer / createEvent /      */
/*   share — cả ba đều render qua Sheet ở shell.tsx, cơ chế lớp đặt   */
/*   TẠI app.tsx vì đây là nơi duy nhất thấy cả 3 state cùng lúc;     */
/*   Sheet ở shell.tsx là component trình bày thuần, không tự biết    */
/*   nó đang ở trên lớp nào). Đóng sheet bằng UI (X / backdrop / Esc  */
/*   đều qua onClose của Sheet) → history.back() có guard để         */
/*   popstate handler bỏ qua lần pop tự gây ra đó.                    */
/* - Back thật (popstate không có guard): đối chiếu nhãn của entry    */
/*   đích — đích là book → đóng sheet trên cùng; đích là landing →   */
/*   về landing. Forward cũng đối chiếu tương tự (vào lại sổ/sheet).  */
/* - Đổi sheet trực tiếp (Ghi khoản → Tạo đám): replaceState đổi     */
/*   nhãn của lớp sheet trên cùng, không chồng thêm lớp.              */
/*                                                                    */
/* Mọi entry do app tạo mang state { sodamNav: 1, layer, bookId,     */
/* sheet }; entry không mang nhãn này (trang trước khi vào app, hoặc  */
/* state bị ghi đè) được hiểu là landing khi đối chiếu.               */
/* ------------------------------------------------------------------ */
type SodamSheetId = 'composer' | 'createEvent' | 'share';
type SodamNavLayer = 'landing' | 'book' | 'sheet';
type SodamNavState = {
  sodamNav: 1;
  layer: SodamNavLayer;
  bookId: string | null;
  sheet: SodamSheetId | null;
};

function readNavState(): SodamNavState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.history.state as Partial<SodamNavState> | null;
  if (!raw || raw.sodamNav !== 1) return null;
  if (raw.layer !== 'landing' && raw.layer !== 'book' && raw.layer !== 'sheet') return null;
  return {
    sodamNav: 1,
    layer: raw.layer,
    bookId: typeof raw.bookId === 'string' ? raw.bookId : null,
    sheet:
      raw.sheet === 'composer' || raw.sheet === 'createEvent' || raw.sheet === 'share'
        ? raw.sheet
        : null,
  };
}

function navStateFor(
  layer: SodamNavLayer,
  bookId: string | null,
  sheet: SodamSheetId | null = null,
): SodamNavState {
  return { sodamNav: 1, layer, bookId, sheet };
}

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
  // W3: gương state điều hướng để popstate handler (đăng ký 1 lần) luôn
  // đọc được giá trị mới nhất mà không phải đăng ký lại listener.
  // Gương qua effect (chạy sau mỗi render) — KHÔNG gán ref ngay trong
  // thân render: react-hooks/refs (eslint-config-next 16) cấm mutate
  // ref lúc render; popstate chỉ tới sau khi effect đã chạy nên hành
  // vi không đổi.
  const bookIdRef = useRef<string | null>(null);
  useEffect(() => {
    bookIdRef.current = bookId;
  });
  const sheetStackRef = useRef<SodamSheetId[]>([]);
  // W3: số lần history.back() do chính app gọi để tiêu thụ lớp khi đóng
  // bằng UI — popstate tương ứng bị bỏ qua. Guard tự hết hạn sau 1s nếu
  // vì lý do nào đó không có popstate nào tới (tránh nuốt Back thật sau này).
  const navGuardRef = useRef(0);
  const navGuardTimerRef = useRef<number | null>(null);
  // W3: khôi phục sổ sau reload chỉ chạy MỘT lần lúc mount; sau đó nếu
  // người dùng chủ động về landing trong phiên thì không tự nhảy lại.
  const restoreTriedRef = useRef(false);

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

  const refreshBooks = useCallback(async (): Promise<SodamBook[]> => {
    try {
      const list = await api.listBooks(mode === 'mock' ? [] : knownBookCodes());
      setBooks(list);
      for (const b of list) rememberBook(b.id, b.inviteCode, b.name);
      setError(null);
      return list;
    } catch (e) {
      if (navigator.onLine) setError(friendlyError(e, 'Lỗi tải sổ'));
      return [];
    }
  }, [api, mode]);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  /* ---------------- W3: điều hướng / Back / khôi phục -------------- */

  // Tiêu thụ `steps` lớp history do chính app vừa đẩy, một cách im lặng:
  // đánh dấu guard trước khi gọi history.back() để popstate handler biết
  // đây là lần pop tự gây ra (state React đã được cập nhật ở phía UI rồi).
  const consumeHistoryLayers = useCallback((steps: number) => {
    if (steps <= 0) return;
    navGuardRef.current += steps;
    if (navGuardTimerRef.current) window.clearTimeout(navGuardTimerRef.current);
    navGuardTimerRef.current = window.setTimeout(() => {
      navGuardRef.current = 0;
      navGuardTimerRef.current = null;
    }, 1000);
    window.history.go(-steps);
  }, []);

  const setSheetOpenRaw = useCallback((id: SodamSheetId, open: boolean) => {
    if (id === 'composer') setComposerOpen(open);
    else if (id === 'createEvent') setCreateEventOpen(open);
    else setShareOpen(open);
  }, []);

  // Vào sổ (mọi đường: tạo / join / mở từ landing / qua link / khôi phục /
  // đổi sổ từ rail): ghi lastBookId + đẩy đúng MỘT lớp book khi cần.
  const enterBook = useCallback((id: string, opts?: { face?: Face }) => {
    rememberLastBook(id);
    const prev = bookIdRef.current;
    setBookId(id);
    setFace(opts?.face ?? 'overview');
    const nav = readNavState();
    if (!prev) {
      // Đang ở entry landing: đẩy lớp book. Nếu entry hiện tại ĐÃ là
      // lớp book/sheet của đúng sổ này (reload khi đang trong sổ —
      // history.state sống qua reload) thì chuẩn hoá về lớp book,
      // không đẩy trùng.
      if (nav && nav.bookId === id && nav.layer !== 'landing') {
        window.history.replaceState(navStateFor('book', id), '');
      } else {
        window.history.pushState(navStateFor('book', id), '');
      }
    } else if (prev !== id) {
      // Đổi sổ ngay trong workspace: vẫn một lớp book — sửa nhãn của
      // entry hiện tại (nếu đang có sheet mở thì giữ nguyên lớp sheet,
      // chỉ cập nhật bookId trong nhãn của nó ở lần đồng bộ sau).
      if (nav && nav.layer === 'book') {
        window.history.replaceState(navStateFor('book', id), '');
      }
    }
  }, []);

  // Về landing do người dùng chủ động (nút Home / Tạo sổ): xoá lastBookId
  // và tiêu thụ các lớp đã đẩy (sheet nếu còn + book) để Back tiếp theo
  // ở landing là hành vi trình duyệt bình thường.
  const goHomeFromUi = useCallback(() => {
    clearLastBook();
    const openSheets = sheetStackRef.current.length;
    sheetStackRef.current = [];
    setComposerOpen(false);
    setCreateEventOpen(false);
    setShareOpen(false);
    setOverflowOpen(false);
    setBookId(null);
    const nav = readNavState();
    if (nav && nav.layer === 'sheet') consumeHistoryLayers(openSheets + 1);
    else if (nav && nav.layer === 'book') consumeHistoryLayers(1);
  }, [consumeHistoryLayers]);

  // Mở sheet = đẩy một lớp sheet lên trên lớp book.
  const openSheetLayer = useCallback(
    (id: SodamSheetId) => {
      if (!sheetStackRef.current.includes(id)) {
        sheetStackRef.current = [...sheetStackRef.current, id];
      }
      setSheetOpenRaw(id, true);
      const nav = readNavState();
      if (nav?.layer === 'sheet' && nav.sheet === id) return;
      window.history.pushState(navStateFor('sheet', bookIdRef.current, id), '');
    },
    [setSheetOpenRaw],
  );

  // Đóng sheet bằng UI (X / backdrop / Esc — tất cả qua onClose): nếu đây
  // là lớp trên cùng thì tiêu thụ lớp history của nó; đóng sheet không
  // phải trên cùng (hiếm) thì chỉ sửa lại nhãn của entry trên cùng.
  const closeSheetFromUi = useCallback(
    (id: SodamSheetId) => {
      const stack = sheetStackRef.current;
      const wasTop = stack[stack.length - 1] === id;
      sheetStackRef.current = stack.filter((s) => s !== id);
      setSheetOpenRaw(id, false);
      const nav = readNavState();
      if (wasTop && nav?.layer === 'sheet' && nav.sheet === id) {
        consumeHistoryLayers(1);
      } else if (nav?.layer === 'sheet' && sheetStackRef.current.length > 0) {
        const top = sheetStackRef.current[sheetStackRef.current.length - 1];
        window.history.replaceState(navStateFor('sheet', bookIdRef.current, top), '');
      }
    },
    [consumeHistoryLayers, setSheetOpenRaw],
  );

  // Đổi thẳng từ sheet này sang sheet khác (Ghi khoản → Tạo đám): giữ
  // nguyên MỘT lớp sheet, chỉ đổi nhãn — Back sau đó vẫn đóng sheet
  // đang mở và giữ nguyên workspace.
  const swapSheetLayer = useCallback(
    (from: SodamSheetId, to: SodamSheetId) => {
      sheetStackRef.current = [...sheetStackRef.current.filter((s) => s !== from && s !== to), to];
      setSheetOpenRaw(from, false);
      setSheetOpenRaw(to, true);
      const nav = readNavState();
      if (nav?.layer === 'sheet') {
        window.history.replaceState(navStateFor('sheet', bookIdRef.current, to), '');
      } else {
        window.history.pushState(navStateFor('sheet', bookIdRef.current, to), '');
      }
    },
    [setSheetOpenRaw],
  );

  // Gắn nhãn cho entry đầu tiên lúc mount (không đẩy entry mới) + đăng
  // ký popstate MỘT lần. Nếu entry hiện tại đã mang nhãn của app (reload
  // giữ nguyên history stack) thì giữ nguyên, chờ khôi phục xử lý tiếp.
  useEffect(() => {
    if (!readNavState()) {
      window.history.replaceState(navStateFor('landing', null), '');
    }
    const onPopState = () => {
      // Pop do chính app gây ra để tiêu thụ lớp khi đóng bằng UI: state
      // React đã đúng rồi — chỉ việc trừ guard.
      if (navGuardRef.current > 0) {
        navGuardRef.current -= 1;
        if (navGuardRef.current === 0 && navGuardTimerRef.current) {
          window.clearTimeout(navGuardTimerRef.current);
          navGuardTimerRef.current = null;
        }
        return;
      }
      const nav = readNavState();
      const targetBookId = nav && nav.layer !== 'landing' ? nav.bookId : null;
      const targetSheet = nav?.layer === 'sheet' ? nav.sheet : null;
      // Đồng bộ sheet: đóng mọi sheet khác sheet đích, mở sheet đích.
      const nextStack: SodamSheetId[] = targetSheet ? [targetSheet] : [];
      for (const id of sheetStackRef.current) {
        if (!nextStack.includes(id)) setSheetOpenRaw(id, false);
      }
      if (targetSheet && !sheetStackRef.current.includes(targetSheet)) {
        setSheetOpenRaw(targetSheet, true);
      }
      sheetStackRef.current = nextStack;
      // Đồng bộ sổ: đích landing → về landing (và xoá lastBookId như khi
      // bấm Home); đích có sổ → vào lại sổ đó (đường Forward).
      if (targetBookId) {
        rememberLastBook(targetBookId);
        if (bookIdRef.current !== targetBookId) setBookId(targetBookId);
      } else {
        clearLastBook();
        if (bookIdRef.current) setBookId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setSheetOpenRaw]);

  // W3 (6.3): khôi phục sổ sau reload — chạy đúng một lần lúc mount.
  // Điều kiện: chưa có sổ nào mở, URL không có ?code= (link chia sẻ có
  // đường vào riêng và thắng khôi phục), lastBookId còn trong registry
  // của máy VÀ đối chiếu được với danh sách sổ server trả về (mock mode:
  // registry là nguồn đối chiếu vì listBooks mock không nhận codes).
  useEffect(() => {
    if (restoreTriedRef.current) return;
    restoreTriedRef.current = true;
    if (bookIdRef.current) return;
    if (new URLSearchParams(window.location.search).get('code')) return;
    const last = lastBookId();
    if (!last) return;
    if (!knownBooks().some((b) => b.id === last)) {
      clearLastBook();
      return;
    }
    void (async () => {
      const list = await refreshBooks();
      const confirmed =
        mode === 'mock' ? knownBooks().some((b) => b.id === last) : list.some((b) => b.id === last);
      if (!confirmed) {
        // Sổ không còn đối chiếu được (đã bị xoá / mã đã xoay và registry
        // lệch) — dọn lastBookId để các lần nạp sau không thử lại vô ích.
        if (list.length > 0 || mode !== 'mock') clearLastBook();
        return;
      }
      if (bookIdRef.current) return; // người dùng/link đã vào sổ khác trong lúc chờ
      enterBook(last);
    })();
  }, [refreshBooks, enterBook, mode]);

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
        enterBook(book.id);
      } catch {
        setLinkJoinError({
          code,
          message:
            'Không tìm thấy sổ với mã này — kiểm tra lại mã hoặc mở link chia sẻ là vào thẳng.',
        });
      } finally {
        // Xoá ?code khỏi URL nhưng GIỮ nhãn lớp history của entry hiện
        // tại (W3): replaceState không đổi state sẽ xoá nhãn book vừa
        // đẩy khi vào sổ qua link, làm Back sau đó mất lớp để đối chiếu.
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState(window.history.state, '', url.toString());
      }
    })();
  }, [api, refreshBooks, enterBook]);

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
      openSheetLayer('composer');
    },
    [activeEventId, dash, events, openSheetLayer],
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
              enterBook(book.id);
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
              enterBook(book.id);
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
            enterBook(id);
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
          openSheetLayer('share');
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
        <Sheet open title={`Chia sẻ sổ`} onClose={() => closeSheetFromUi('share')}>
          <SharePanel
            api={api}
            book={activeBook}
            onClose={() => closeSheetFromUi('share')}
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
          if (shareOpen) closeSheetFromUi('share');
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
          enterBook(id);
          setSearchQuery('');
        }}
        onSelectEvent={(id) => {
          setActiveEventId(id);
          setFace('event');
        }}
        onFace={(f) => setFace(f)}
        onHome={goHomeFromUi}
        onCreateBook={goHomeFromUi}
        onCreateEvent={() => openSheetLayer('createEvent')}
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
              onCreateEvent={() => openSheetLayer('createEvent')}
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
        onClose={() => closeSheetFromUi('createEvent')}
        onCreated={(ev, ghiNgay) => {
          // Tạo xong mà ghi ngay: lớp sheet Tạo đám BIẾN THÀNH lớp Ghi
          // khoản (swap nhãn history, không chồng thêm lớp) để Back sau
          // đó đóng Ghi khoản về đúng workspace. openComposer ở đây chỉ
          // chốt composerEventId — lớp sheet đã được swap lo phần history
          // (openSheetLayer thấy nhãn đã khớp nên không đẩy trùng).
          if (ghiNgay) {
            swapSheetLayer('createEvent', 'composer');
            setActiveEventId(ev.id);
            void reloadWorkspace();
            openComposer(ev.id);
          } else {
            closeSheetFromUi('createEvent');
            setActiveEventId(ev.id);
            void reloadWorkspace();
            setFace('event');
          }
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
          onClose={() => closeSheetFromUi('composer')}
          onSaved={() => void reloadWorkspace()}
          onCreateEvent={() => swapSheetLayer('composer', 'createEvent')}
        />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
