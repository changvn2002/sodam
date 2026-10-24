'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Clock, Copy, Minus, Plus, Search, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfflineBanner } from './ui/offline-ui';
import { Btn } from './shell-primitives';
import { GROUP_STYLE, groupOfKind } from './lib/lexicon';
import type { SodamEvent } from './api/types';

export type SodamFace = 'overview' | 'event' | 'returns' | 'people' | 'tree';

export const FACE_LABELS: Record<SodamFace, string> = {
  overview: 'Tổng quan',
  event: 'Đám',
  returns: 'Trả lễ',
  people: 'Người',
  tree: 'Cây họ',
};

const FACE_ORDER: SodamFace[] = ['overview', 'returns', 'people', 'tree'];

/** Mã mời hiển thị theo nhóm 4 ký tự (A11Y-09). */
export function formatInviteCode(code: string): string {
  const clean = code.replace(/\s+/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/* ------------------------------------------------------------------ */
/* Khung sườn Command Ledger (REDESIGN-V2): rail trái chàm ở desktop, */
/* khối trên + thanh ghi nhanh ghim đáy ở mobile. Rail kể câu chuyện  */
/* sổ → đám → mặt; vùng children cuộn nội bộ, trang không dài theo    */
/* dữ liệu (SC-2).                                                    */
/* ------------------------------------------------------------------ */

export type WorkspaceShellProps = {
  bookName: string;
  inviteCode?: string;
  online: boolean;
  error: string | null;
  books: Array<{ id: string; name: string }>;
  events: SodamEvent[];
  activeBookId: string | null;
  activeEventId: string | null;
  face: SodamFace;
  returnsBadge?: number;
  onSelectBook: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onFace: (face: SodamFace) => void;
  onHome: () => void;
  onCreateBook: () => void;
  onCreateEvent: () => void;
  totalsStrip?: ReactNode;
  commandBar?: ReactNode;
  /* F7′ (Recheck R2, phân xử coordinator): suppression bám theo BỀ MẶT
     ĐANG XEM — đang ở mặt chi tiết đám tang/giỗ thì TOÀN chrome của
     view đó trung tính (chấm sidebar của MỌI đám + «Chia sẻ» header +
     gạch tab); ở các mặt cấp sổ khác accent bình thường. Shell nhận
     prop này CHỈ để nhuộm trung tính các chi tiết chrome đó; phần thân
     chi tiết tang/giỗ tự giữ kỷ luật riêng (event-face, TotalsStrip). */
  suppressChromeAccent?: boolean;
  outboxChip?: ReactNode;
  shareMenu?: ReactNode;
  overflowMenu?: ReactNode;
  mobileTotal?: { label: string; value: string };
  quickBarAction?: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({
  bookName,
  online,
  error,
  books,
  events,
  activeBookId,
  activeEventId,
  face,
  returnsBadge,
  onSelectBook,
  onSelectEvent,
  onFace,
  onHome,
  onCreateBook,
  onCreateEvent,
  totalsStrip,
  commandBar,
  suppressChromeAccent = false,
  outboxChip,
  shareMenu,
  overflowMenu,
  mobileTotal,
  quickBarAction,
  children,
}: WorkspaceShellProps) {
  const railSectionLabel =
    'px-5 pt-5 pb-1.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-muted uppercase';
  const railRow =
    'flex min-h-11 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Rail — desktop: cột bìa sổ TRẮNG, kẻ dọc mảnh như gáy sổ (B′). */}
      <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-line bg-card text-ink lg:flex">
        <div className="masthead-rule mx-5 flex items-center gap-2.5 pt-5 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo là SVG tĩnh trong public/ (asset nội bộ cố định); next/image không tối ưu SVG nên <img> thẳng là đúng */}
          <img
            src="/products/brand/sodam-logo.svg"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-[7px]"
          />
          <p className="font-mono text-[15px] font-bold tracking-[0.18em] uppercase">
            Sổ<span className="text-indigo-700">·</span>Đám
          </p>
        </div>

        <p className={railSectionLabel}>Sổ</p>
        <nav aria-label="Sổ của bạn" className="space-y-0.5 px-2">
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectBook(b.id)}
              aria-current={b.id === activeBookId ? 'true' : undefined}
              className={cn(
                railRow,
                b.id === activeBookId
                  ? 'bg-indigo-50 font-semibold text-ink'
                  : 'text-muted hover:bg-indigo-50 hover:text-ink',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCreateBook}
            className={cn(railRow, 'font-medium text-muted hover:bg-indigo-50 hover:text-ink')}
          >
            <Plus className="size-4 shrink-0" aria-hidden /> Tạo sổ
          </button>
        </nav>

        <p className={railSectionLabel}>Đám</p>
        <nav aria-label="Đám trong sổ" className="space-y-0.5 px-2">
          {events.map((e) => {
            const style = GROUP_STYLE[groupOfKind(e.kind)];
            const active = e.id === activeEventId && face === 'event';
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvent(e.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  railRow,
                  active
                    ? 'bg-indigo-50 font-semibold text-ink'
                    : 'text-muted hover:bg-indigo-50 hover:text-ink',
                )}
              >
                {/* F7′ (Recheck R2): ở mặt chi tiết đám tang/giỗ, chấm
                    của MỌI đám trong rail về trung tính — suppression
                    bám theo bề mặt đang xem. Ở mọi mặt khác, chấm là
                    DANH TÍNH của chính đám đó (GROUP_STYLE). */}
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    suppressChromeAccent ? 'bg-muted' : style.dot,
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onCreateEvent}
            className={cn(railRow, 'font-medium text-muted hover:bg-indigo-50 hover:text-ink')}
          >
            <Plus className="size-4 shrink-0" aria-hidden /> Tạo đám
          </button>
        </nav>

        <p className={railSectionLabel}>Xem sổ</p>
        <nav aria-label="Các mục xem sổ" className="space-y-0.5 px-2">
          {FACE_ORDER.map((f) => {
            const active = face === f || (f === 'overview' && face === 'event');
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFace(f)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  railRow,
                  active
                    ? 'bg-indigo-50 font-semibold text-ink'
                    : 'text-muted hover:bg-indigo-50 hover:text-ink',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{FACE_LABELS[f]}</span>
                {f === 'returns' && returnsBadge ? (
                  <span className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 px-1.5 font-mono text-xs font-semibold text-ink tabular-nums">
                    {returnsBadge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {outboxChip ? <div className="mt-auto px-4 pt-4 pb-5">{outboxChip}</div> : null}
      </aside>

      {/* Cột phải */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Thanh trên — desktop */}
        <header className="hidden min-h-[52px] items-center gap-3 border-b border-line bg-card px-5 lg:flex">
          <div className="min-w-0 flex-1">
            {/* F14 (Panel R1): bỏ meta-text thuyết minh «Đang xem: …»
                khỏi UI — sidebar đã tô vị trí; tên sổ là H1 duy nhất. */}
            <h1 className="truncate text-[17px] leading-tight font-semibold">{bookName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {shareMenu}
            {overflowMenu}
          </div>
        </header>

        {/* Khối trên — mobile */}
        <div className="border-b border-line bg-card lg:hidden">
          <div className="flex min-h-14 items-center gap-1 px-2">
            <button
              type="button"
              onClick={onHome}
              aria-label="Về danh sách sổ"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{bookName}</h1>
            <div className="flex shrink-0 items-center">
              {shareMenu}
              {overflowMenu}
            </div>
          </div>

          {/* F5 (Panel R1): BỎ hàng pill chọn đám ở mobile — pill bị cắt
              cụt giữa chữ và chồng cơ chế với dropdown chọn đám trong
              CommandBar. Mobile nay chỉ còn MỘT cơ chế chọn đám duy nhất:
              ô chọn (dropdown) cạnh nút ghi khoản. Tạo đám vẫn tới được
              từ mặt Tổng quan / ô chọn khi chưa có đám. */}

          <nav aria-label="Các mục xem sổ" className="flex px-2">
            {FACE_ORDER.map((f) => {
              const active = face === f || (f === 'overview' && face === 'event');
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFace(f)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'relative inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-1 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    active ? 'font-semibold text-ink' : 'font-medium text-muted',
                  )}
                >
                  {FACE_LABELS[f]}
                  {f === 'returns' && returnsBadge ? (
                    <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-indigo-50 px-1 font-mono text-xs font-semibold text-ink tabular-nums">
                      {returnsBadge}
                    </span>
                  ) : null}
                  {active ? (
                    // F7′: gạch chân tab thuộc chrome của view đang xem —
                    // ở mặt chi tiết tang/giỗ nó về MỰC trung tính; ở các
                    // mặt cấp sổ giữ accent thường.
                    <span
                      className={cn(
                        'absolute right-2 bottom-0 left-2 h-0.5',
                        suppressChromeAccent ? 'bg-ink' : 'bg-indigo-700',
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <OfflineBanner online={online} />
        {commandBar}
        {totalsStrip}

        {error ? (
          <div className="px-4 pt-3 lg:px-5">
            <p
              role="alert"
              className="rounded-xl border border-lacquer bg-card px-3 py-2.5 text-sm text-ink"
            >
              {error}
            </p>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {/* Thanh hành động ghim đáy — mobile. F10: thanh này là nơi DUY
            NHẤT còn nút «Ghi khoản» ở mobile (nút ở CommandBar chỉ hiện
            ở desktop) và KHÔNG lặp số «Còn giữ» (số đó sống một mình
            trong TotalsStrip). Không có hành động/hàng chờ thì không
            dựng thanh. */}
        {quickBarAction || outboxChip ? (
          <div
            className="flex min-h-[52px] items-center gap-3 border-t border-line bg-card px-4 py-2 lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {mobileTotal ? (
              <span className="sr-only">{`${mobileTotal.label}: ${mobileTotal.value}`}</span>
            ) : null}
            {outboxChip}
            {quickBarAction ? <div className="ml-auto shrink-0">{quickBarAction}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Command bar: nút ghi khoản phổ quát + chọn đám + tìm trong bảng.  */
/* ------------------------------------------------------------------ */

export function CommandBar({
  onQuickEntry,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  showSearch = false,
  events,
  activeEventId,
  onSelectEvent,
  outboxChip,
}: {
  onQuickEntry: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  showSearch?: boolean;
  events: SodamEvent[];
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  outboxChip?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line bg-card px-4 py-1.5 lg:px-5">
      {/* F10: ở mobile nút này TRÙNG với nút ghim đáy — chỉ hiện ở
          desktop, mobile dùng đúng một nút ở thanh đáy. */}
      <span className="hidden lg:inline-flex">
        <Btn onClick={onQuickEntry}>
          <Plus className="size-4" aria-hidden /> Ghi khoản
        </Btn>
      </span>
      {events.length > 0 ? (
        <label className="sr-only" htmlFor="sodam-event-select">
          Chọn đám đang xem
        </label>
      ) : null}
      {events.length > 0 ? (
        <select
          id="sodam-event-select"
          aria-label="Chọn đám đang xem"
          value={activeEventId ?? ''}
          onChange={(e) => {
            if (e.target.value) onSelectEvent(e.target.value);
          }}
          // W3-1 (Recheck R2, ghế 4 mục 8): tên đám là định danh chính
          // của app — ô chọn phải hiện TRỌN tên. Bỏ hộp bó max-w-44:
          // ô chiếm trọn một hàng riêng ở mobile (basis-full) và giãn
          // linh hoạt tới 40rem ở desktop, đủ cho cả tên đám dài nhất
          // của sổ fixture (64 ký tự ≈ 500px ở 14px).
          className="min-h-11 w-full min-w-0 flex-1 basis-full rounded-[10px] border border-line-strong bg-card px-2.5 text-sm text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-auto sm:basis-80 sm:max-w-[40rem]"
        >
          <option value="" disabled>
            Chọn đám
          </option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      ) : null}
      {showSearch ? (
        <div className="relative min-w-36 flex-1 sm:max-w-xs sm:flex-none sm:basis-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <label className="sr-only" htmlFor="sodam-search">
            {searchLabel ?? 'Tìm trong bảng'}
          </label>
          <input
            id="sodam-search"
            type="search"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder ?? 'Tìm…'}
            aria-label={searchLabel ?? 'Tìm trong bảng'}
            className="min-h-11 w-full rounded-[10px] border border-line-strong bg-card pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : null}
      {outboxChip ? <span className="hidden lg:inline-flex">{outboxChip}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dải tổng của sổ: 4 số trung tính + dòng phụ các hạng đã đi (mono). */
/*                                                                    */
/* TC-1 (Panel #04): dòng phụ KHÔNG còn là phương trình lấy đã nhận   */
/* trừ đã đi ra số còn giữ — phương trình đó ghép 2 định nghĩa        */
/* khác nhau dưới một dấu «=» ("còn giữ" chỉ trừ phần trả lễ trong     */
/* khoản đã nhận) nên lệch đúng trả dư + đi đám. Nay dòng phụ là các   */
/* hạng có nhãn riêng do lib/totals-strip.ts tính từ số thô: phần đã  */
/* đi trong khoản đã nhận (= settledVnd) và phần trả dư + đi đám      */
/* (= givenVnd − settledVnd); tổng hai hạng = tổng đã đi.             */
/* ------------------------------------------------------------------ */

export function TotalsStrip({
  received,
  given,
  kept,
  pendingLabel,
  pendingValue,
  pendingCount,
  terms,
  hidePending = false,
  hideTerms = false,
}: {
  received: string;
  given: string;
  kept: string;
  pendingLabel: string;
  pendingValue: string;
  pendingCount: number;
  /** Các hạng đã format sẵn (nhãn + tiền) từ totalsTerms() ở app.tsx. */
  terms?: Array<{ label: string; value: string }>;
  /** F3 (Panel R1): trên mặt chi tiết đám TANG/GIỖ, khung nợ «Cần trả
      lễ» không đè đầu màn — ẩn đúng hàng đó; các hàng tổng khác giữ. */
  hidePending?: boolean;
  /** W3-8 (Recheck R2, ghế 5): dòng PHÂN RÃ («Đã đi trong khoản đã
      nhận … · Trả dư + đi đám …») là chữ tiền nong giải thích sổ —
      không nằm trên mặt chi tiết tang/giỗ; giữ ở Tổng quan / Trả lễ /
      chi tiết hỷ như cũ. */
  hideTerms?: boolean;
}) {
  const cells = [
    { label: 'Tổng đã nhận', value: received },
    // Phạm vi tường minh (MEDIUM Panel #03): tổng này gồm CẢ đi đám lẫn trả
    // lễ — khác cột "Đi đám" theo-người ở mặt Người (chỉ tính đám đi dự).
    { label: 'Tổng đã đi (đi đám + trả lễ)', value: given },
    { label: 'Còn giữ', value: kept },
    ...(hidePending
      ? []
      : [
          {
            label: pendingLabel,
            value: pendingValue,
            sub: pendingCount > 0 ? `${pendingCount} khoản` : undefined,
          },
        ]),
  ];
  return (
    <section aria-label="Tổng của sổ" className="border-b border-line bg-card px-4 py-1 lg:px-5">
      {/* B′: dải tổng là các HÀNG SỔ — nhãn trái, số Mono phải, hairline
          ngăn hàng; không còn tường chữ wrap lộn xộn ở 390px. */}
      <div className="divide-y divide-line">
        {cells.map((c) => (
          <p key={c.label} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
            <span className="font-medium text-ink">
              {c.label}
              {c.sub ? <span> ({c.sub})</span> : null}
            </span>
            <span className="font-mono text-[15px] font-semibold whitespace-nowrap tabular-nums">
              {c.value}
            </span>
          </p>
        ))}
      </div>
      {/* Panel #02 mục 5 giữ nguyên kỷ luật: KHÔNG truncate — từng hạng là
          một khối nowrap, dòng phụ tự xuống dòng giữa các hạng để mọi con
          số luôn hiện trọn trên mobile 390px. Hạng rỗng → không render.
          TC5-1 (Panel #05): dấu «·» gắn ở CUỐI hạng trước, KHÔNG làm tiền
          tố của hạng sau — khi wrap ở 320/390px dòng 2 không bao giờ bắt
          đầu bằng «·»; ở 1440 dấu vẫn nối hai hạng trên một dòng. */}
      {/* F9 (Panel R1, ghế 2): dòng chú thích này là CHỮ GÁNH NIỀM TIN
          (giải thích vì sao 7,2 / 6,7 / 6,3tr khác nhau) — nâng cỡ + đậm,
          nhãn tiếng người nhà thường, số giữ Mono đậm; hết cảnh dòng quan
          trọng nhất lại nhỏ/mờ nhất màn. */}
      {!hideTerms && terms && terms.length > 0 ? (
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] leading-relaxed font-medium text-ink">
          {terms.map((t, i) => (
            <span key={t.label} className="whitespace-nowrap">
              {t.label} <span className="font-mono font-bold tabular-nums">{t.value}</span>
              {i < terms.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}

/** Mã mời mono theo nhóm 4 + nút chép ≥44px. */
export function InviteCodeChip({ code, dark = false }: { code: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bị chặn — mã vẫn đọc/chép tay được từ chính chip này.
    }
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-3',
        dark ? 'bg-indigo-900 text-white' : 'border border-line bg-indigo-50 text-ink',
      )}
    >
      <span className="font-mono text-[13px] font-medium tracking-wide tabular-nums">
        {formatInviteCode(code)}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          dark ? 'text-indigo-100 hover:text-white' : 'text-indigo-700 hover:bg-card',
        )}
        aria-label={copied ? 'Đã chép mã mời' : 'Chép mã mời'}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
}

export function SegmentedTabs({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto rounded-xl border border-line bg-indigo-50 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              // F16: trạng thái chọn phải NHÌN THẤY như nhau ở 390 và 1440 —
              // nền trắng + viền đậm + bóng rõ, không chỉ đậm chữ.
              active
                ? 'bg-card font-bold text-ink shadow-[var(--shadow-lift)] ring-1 ring-line-strong'
                : 'font-medium text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* W4-2 (Panel final R3, ghế 3): hàng chọn theo NGÔN NGỮ SỔ — chữ trần
   trên kẻ ngang, ngăn bằng kẻ dọc, mục đang chọn = chữ đậm + gạch mực
   ở chân ô; KHÔNG khay pill/nền/viên nổi. Cùng cơ chế với toggle
   «Gõ tay/Giọng nói» đã duyệt ở W3-5 (panels/quick-entry.tsx). Dùng ở
   mặt tiền (Tạo sổ / Vào bằng mã) và thanh lọc Trả lễ; SegmentedTabs
   giữ nguyên cho các chỗ ngoài hợp đồng W4. */
export function LedgerTabs({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex divide-x divide-line overflow-x-auto border-y border-line', className)}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset',
              active
                ? 'font-bold text-ink shadow-[inset_0_-2px_0_0_#1F2328]'
                : 'font-medium text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({
  status,
  label,
  accentDot = false,
}: {
  status: 'OPEN' | 'DONE' | 'OVER' | 'SKIPPED' | 'PENDING';
  label?: string;
  /** F9 (Panel R1): chấm accent cho «Chờ trả» — CHỈ nơi gọi thuộc phạm
      vi hỷ mới truyền true; bề mặt tang/giỗ không bao giờ có chấm này. */
  accentDot?: boolean;
}) {
  // F9: trạng thái phải phân biệt được bằng CHỮ ĐẬM + ICON RÕ cho mắt
  // kém — cỡ chữ/icon nâng lên, nhãn font-bold, icon 16px nét đậm.
  const base =
    'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-indigo-50 px-3 text-[13px] font-bold whitespace-nowrap text-ink';
  if (status === 'PENDING') {
    return (
      <span className={base}>
        <Clock className="size-4" strokeWidth={2.4} aria-hidden />
        {label ?? 'Đang chờ gửi'}
      </span>
    );
  }
  if (status === 'DONE') {
    return (
      <span className={base}>
        <Check className="size-4" strokeWidth={2.6} aria-hidden />
        {label ?? 'Đã trả'}
      </span>
    );
  }
  if (status === 'OVER') {
    return (
      <span className={base}>
        <TriangleAlert className="size-4" strokeWidth={2.4} aria-hidden />
        {label ?? 'Trả dư'}
      </span>
    );
  }
  if (status === 'SKIPPED') {
    return (
      <span className={base}>
        <Minus className="size-4" strokeWidth={2.6} aria-hidden />
        {label ?? 'Bỏ qua'}
      </span>
    );
  }
  return (
    <span className={base}>
      {accentDot ? (
        <span className="size-2 shrink-0 rounded-full bg-indigo-700" aria-hidden />
      ) : null}
      <Clock className="size-4" strokeWidth={2.4} aria-hidden />
      {label ?? 'Chờ trả'}
    </span>
  );
}

/** Bottom sheet trên mobile / dialog giữa màn hình trên desktop. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl bg-card shadow-[var(--shadow-lift)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-indigo-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Đóng cửa sổ"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Trạng thái trống chuẩn: minh hoạ sổ mở vẽ tay + 1 câu + 1 CTA.
 *
 * Panel #02 mục 7: ảnh raster cũ (sodam-empty.webp) dán nguyên khối nền xám
 * #f6f6f6 lệch tông với mọi canvas (paper #f5f5f7 / card trắng). Nay vẽ SVG
 * inline ngay tại đây — nền trong suốt, nét chàm + điểm vàng thuộc hệ
 * redesign — nên khớp tông ở mọi bề mặt và không tốn một request nào.
 */
export function EmptyLedger({
  title,
  body,
  action,
  variant = 'ledger',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  /**
   * B7 (Panel #03 / R1): minh hoạ sổ + xu vàng dùng chung cả ngữ cảnh tang
   * là không phù hợp trang trọng. `solemn` = biến thể bát hương tông trầm
   * (cùng tay vẽ/token hiện hữu: solemn-700 + solemn-soft, KHÔNG xu vàng,
   * KHÔNG nét bút ăn mừng) cho mặt đám tang/giỗ và Cây họ ở ngữ cảnh đó.
   */
  variant?: 'ledger' | 'solemn';
}) {
  if (variant === 'solemn') {
    return (
      <div className="flex flex-col items-center px-4 py-6 text-center">
        <svg
          viewBox="0 0 200 132"
          className="h-auto w-full max-w-[200px]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* Bát hương ba nén — cùng glyph kỷ luật với icon đám tang */}
          <path d="M76 34c-3.5-5.5 3.5-8.5 0-14" stroke="#454C54" strokeWidth="2.5" />
          <path d="M100 30c-3.5-5.5 3.5-8.5 0-14" stroke="#454C54" strokeWidth="2.5" />
          <path d="M124 34c-3.5-5.5 3.5-8.5 0-14" stroke="#454C54" strokeWidth="2.5" />
          <path d="M76 40v26M100 36v30M124 40v26" stroke="#454C54" strokeWidth="2.5" />
          <path d="M52 66h96a48 30 0 0 1-96 0Z" fill="#F6F8FA" stroke="#454C54" strokeWidth="2.5" />
          <path d="M78 108h44" stroke="#454C54" strokeWidth="2.5" />
          {/* Dòng kẻ sổ trầm dưới bát hương — chờ ghi, không xu, không bút */}
          <path d="M64 122h72" stroke="#8C959F" strokeWidth="2.5" />
        </svg>
        <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <svg
        viewBox="0 0 200 132"
        className="h-auto w-full max-w-[200px]"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* F13 (Panel R1): bỏ minh hoạ «sổ mở» stock + huy hiệu ₫ + nét
            bút/mũi tên vô danh — vẽ lại bằng đúng NGÔN NGỮ SỔ KẺ: một
            trang sổ phẳng, lề dọc, các dòng kẻ chờ ghi và kẻ đôi khép
            trang ở đáy. Không vật trang trí ngoài sổ. */}
        <path d="M52 14h96v104H52z" fill="#F6F8FA" stroke="#1F2328" strokeWidth="2.5" />
        <path d="M66 14v104" stroke="#8C959F" strokeWidth="2" />
        <path d="M78 40h58M78 58h58M78 76h42" stroke="#8C959F" strokeWidth="2.5" />
        <path d="M52 98h96" stroke="#1F2328" strokeWidth="2" />
        <path d="M52 103h96" stroke="#1F2328" strokeWidth="2" />
      </svg>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { Btn, Field, Input, Panel, Select } from './shell-primitives';
