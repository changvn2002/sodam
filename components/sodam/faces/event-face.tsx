'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEntry, SodamEvent } from '../api/types';
import { cn } from '@/lib/utils';
import { kindLabel } from '../lib/event-kinds';
import { GROUP_STYLE, lexiconForKind, sourceLabel } from '../lib/lexicon';
import { nextReturnPay } from '../lib/return-pay';
import { Btn, EmptyLedger, Field, Input, StatusPill } from '../shell';
import { PersonAvatar } from '../ui/avatar';
import { KindIcon } from '../ui/kind-icon';
import { Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import {
  eventDateLabels,
  formatAmountInput,
  friendlyError,
  money,
  QuickAmounts,
  returnConsequence,
  type GhostEntry,
  type PushToast,
} from '../app-shared';

/* ------------------------------------------------------------------ */
/* Mặt Đám: dải meta theo giọng + dải tổng + bảng khoản cuộn nội bộ.  */
/* ------------------------------------------------------------------ */

export function EventFace({
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
      {/* B10 (Panel #03 / R1): băng header nhóm HỶ (cưới…) lạnh như tang vì
          softBg celebratory = indigo-50. Dùng token ấm CÓ SẴN trong DESIGN.md
          (--cream #F7F3E8, giấy ấm) cho riêng băng này — không chế hex mới,
          không đổi palette; GROUP_STYLE trong lexicon.ts giữ nguyên. */}
      <div className="border-b border-line bg-card px-4 py-3 lg:px-5">
        {/* B′ mục 7: phân biệt hỷ/tang bằng CÓ/KHÔNG điểm nhấn + giọng chữ.
            HỶ: kicker «ĐÁM HỶ» mang điểm chạm ấm trầm DUY NHẤT của hệ
            (--hy-ink, ghế 5 kê đơn + parent chuẩn y: hỷ/tang hết cùng gam
            lạnh khi liếc nhìn; đo 6,15:1 trên trắng). TANG/GIỖ: kicker
            xám mực, 0 accent tuyệt đối trên toàn băng này; màu ấm của hỷ
            tuyệt đối không xuất hiện ở tang/giỗ hay chrome chung. */}
        <p
          className={cn(
            'mb-1 font-mono text-[10.5px] font-semibold tracking-[0.18em] uppercase',
            group === 'celebratory' ? 'text-hy-ink' : 'text-muted',
          )}
        >
          {group === 'celebratory'
            ? 'Đám hỷ'
            : group === 'solemn'
              ? 'Đám tang'
              : group === 'memorial'
                ? 'Đám giỗ'
                : group === 'longevity'
                  ? 'Mừng thọ'
                  : 'Đám'}
        </p>
        {/* W3-3 (Recheck R2, ghế 1 + ghế 4 M-2): cụm meta KHÔNG để dòng
            hai bắt đầu bằng «·» — ngày + viên âm lịch là MỘT khối không
            tách (whitespace-nowrap, không dấu «·» tiền tố); khi cụm wrap
            ở 390, dòng hai bắt đầu bằng chính ngày tháng. */}
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-ink">
          <span className={cn('shrink-0', style.accentText)}>
            <KindIcon kind={event.kind} className="size-5" />
          </span>
          <span>
            {kindLabel(event.kind)} · {isHosted ? 'Nhận lễ' : 'Đi đám'} ·{' '}
            {detail?.entryCount ?? event.entryCount ?? 0} {lex.personLabel.toLowerCase()}
          </span>
          {dates ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="font-normal">{dates.solar}</span>
              {dates.lunar ? (
                <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold-ink">
                  {dates.lunar}
                </span>
              ) : null}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-lg leading-snug font-semibold [overflow-wrap:anywhere] text-ink">
          {event.title}
        </p>
        {/* W3-9 (Recheck R2, ghế 5 + phân xử coordinator): hỷ ấm bằng
            GIỌNG CHỮ người nhà, không thêm màu — một câu mừng ở đầu mặt
            chi tiết đám cưới/hỷ, đúng chỗ giỗ có câu «nhớ ơn». */}
        {group === 'celebratory' ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {event.kind === 'CUOI' || event.kind === 'DAM_HOI'
              ? 'Ngày vui của hai cháu — mở trang này ra là thấy bà con quây quần tới mừng, tình nghĩa nhà mình còn đi lại mãi về sau.'
              : 'Ngày vui của nhà mình — bà con tới chung vui, nhà mình ghi lại từng tấm lòng để tình nghĩa còn qua lại lâu dài.'}
          </p>
        ) : null}
        {/* F3 (Panel R1, ghế 5): đám GIỖ có giọng «nhớ ơn» riêng — giỗ
            là ngày nhớ ơn người đã khuất, không đứng ngang một khoản
            chờ thanh toán. */}
        {group === 'memorial' ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Ngày giỗ để nhớ ơn người đã khuất — nhà mình sum họp, tưởng nhớ.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 divide-x divide-line border-b border-line bg-card">
        {totalCells.map((cell) => (
          <div key={cell.label} className="min-w-0 flex-1 px-4 py-2.5 lg:px-5">
            <p className="truncate text-xs text-muted">{cell.label}</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold whitespace-nowrap tabular-nums">
              {money(cell.value)}
            </p>
          </div>
        ))}
      </div>
      {ghosts.length > 0 ? (
        <p
          role="status"
          className="border-b border-line bg-indigo-50 px-4 py-2 text-sm text-ink lg:px-5"
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
          {/* F3: cột «Trả lễ» KHÔNG áp lên người phúng/người dự giỗ —
              bề mặt tang/giỗ không có cột khung nợ. */}
          {solemnLike ? (
            <span className="hidden sm:block" />
          ) : (
            <span className="hidden sm:block">Trả lễ</span>
          )}
        </div>

        {!detail ? (
          <p className="px-4 py-4 text-sm text-muted">Đang tải đám…</p>
        ) : detail.entries.length === 0 && ghosts.length === 0 ? (
          <div className="overflow-y-auto">
            <EmptyLedger
              variant={solemnLike ? 'solemn' : 'ledger'}
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
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto">
            {shownGhosts.map((g, i) => (
              <li
                key={`ghost-${i}`}
                className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5"
              >
                {/* F-r3-1: ghost offline KHÔNG có personId trong kiểu dữ liệu
                    (GhostEntry chỉ có tên) — seed theo id là không thể ở đây;
                    đây là giới hạn dữ kiện của hàng chờ, không phải lỗi render.
                    Mọi hàng CÓ personId đều bắt buộc seed={personId}. */}
                <PersonAvatar name={g.personName} size="md" />
                <span className="min-w-0 flex-1 basis-28">
                  <span className="block text-[15px] leading-snug font-medium [overflow-wrap:anywhere] text-ink">
                    {g.personName}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {sourceLabel(g.source)} · đang chờ gửi
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {money(g.amountVnd)}
                  </span>
                  <StatusPill status="PENDING" />
                </span>
              </li>
            ))}
            {shownEntries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
                  aria-expanded={expandedId === e.id}
                  className="flex min-h-[52px] w-full flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                >
                  <PersonAvatar name={e.personName} seed={e.personId ?? undefined} size="md" />
                  <span className="min-w-0 flex-1 basis-28">
                    {/* B4/D-4: tên người viếng wrap, không ellipsis nhường tiền/chip. */}
                    <span className="block text-[15px] leading-snug font-medium [overflow-wrap:anywhere] text-ink">
                      {e.personName}
                    </span>
                    {/* W3-3 (ghế 1 + ghế 4 M-2): ngày ghi hiện TRỌN bất
                        kể độ dài số tiền — dòng meta KHÔNG truncate nữa;
                        ngày là một khối whitespace-nowrap (dấu «·» gắn
                        cuối phần nguồn ghi), và cụm tiền + trạng thái ở
                        khổ hẹp tự xuống hàng dưới (flex-wrap của nút)
                        thay vì ăn cụt ngày. */}
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1 text-xs text-muted">
                      <span>{sourceLabel(e.source)} ·</span>
                      <span className="whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">
                      {money(e.amountVnd)}
                    </span>
                    {/* F3: badge «Chờ trả / Đã trả / Trả dư» KHÔNG đóng lên
                        người phúng viếng / khách giỗ trên mặt đám tang/giỗ —
                        nghĩa vụ vẫn xem và xử lý được ở mặt Trả lễ bằng
                        giọng «đi lại». Ở đám hỷ, badge giữ nguyên (kèm chấm
                        accent cho «Chờ trả» theo F9). */}
                    {isHosted && e.returnItem && !solemnLike ? (
                      e.returnItem.status === 'DONE' ? (
                        (e.returnItem.overGivenVnd ?? 0) > 0 ? (
                          <StatusPill status="OVER" />
                        ) : (
                          <StatusPill status="DONE" />
                        )
                      ) : e.returnItem.status === 'SKIPPED' ? (
                        <StatusPill status="SKIPPED" />
                      ) : (
                        <StatusPill status="OPEN" accentDot={group === 'celebratory'} />
                      )
                    ) : null}
                  </span>
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
            {/* F10 (Panel R1, ghế 3): trang sổ phải có KẾT — kẻ đôi
                khép danh sách ngay dưới khoản cuối, trang không còn
                «cuộn dở» vào khoảng trắng. */}
            {shownEntries.length + shownGhosts.length > 0 ? (
              <li className="double-rule-t px-4 py-2 text-center text-xs font-medium text-muted">
                Hết danh sách — {shownEntries.length + shownGhosts.length}{' '}
                {lex.personLabel.toLowerCase()} đã ghi
              </li>
            ) : null}
            {/* W3-10/L-5 (ghế 4, «chỉ xử nếu tự nhiên»): đáy trang sổ
                không còn khoảng trắng chết — sau kẻ đôi khép danh sách,
                trang sổ kẻ TIẾP các dòng kẻ trống tới chân trang như
                một trang sổ giấy còn chỗ ghi. Chỉ là nền kẻ mờ
                (aria-hidden, không nội dung, không tương tác). */}
            {shownEntries.length + shownGhosts.length > 0 ? (
              <li
                aria-hidden
                className="min-h-16 flex-1"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent 43px, #D8DEE4 43px, #D8DEE4 44px)',
                }}
              />
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
  // B2: người dùng đã tự sửa ô trả thì không được ghi đè khi tổng khoản đổi.
  const payTouchedRef = useRef(false);
  useEffect(() => {
    setPay((cur) =>
      nextReturnPay({ currentPay: cur, nextReceived: received, touched: payTouchedRef.current }),
    );
  }, [received]);
  const setPayTouched = (v: string) => {
    payTouchedRef.current = true;
    setPay(v);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteDescId = useId();
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
          className="mb-3 rounded-[7px] bg-indigo-50 px-3 py-2.5 text-sm font-medium text-ink"
        >
          Đang offline — sửa và xoá cần có mạng. Ghi khoản mới vẫn được, sẽ vào hàng chờ.
        </p>
      ) : null}

      {event.role === 'HOSTED' && ret ? (
        <div className="mb-4">
          {/* F3: trong bề mặt tang/giỗ, nghĩa vụ gọi là «đi lại» — không
              khung nợ «trả lễ» (lexicon của nhóm đã khóa paidLabel =
              «đã đi lại»; fadeOnly ở đây đúng bằng solemnLike). */}
          <p className="mb-2 text-sm font-medium">{fadeOnly ? 'Đi lại' : 'Trả lễ'}</p>
          {ret.status === 'OPEN' ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label={fadeOnly ? 'Số tiền đi lại' : 'Số tiền trả lễ'}>
                  <Input
                    inputMode="numeric"
                    value={formatAmountInput(pay)}
                    onChange={(e) => setPayTouched(e.target.value.replace(/\D/g, ''))}
                    aria-label={`${fadeOnly ? 'Số tiền đi lại' : 'Số tiền trả lễ'} cho ${entry.personName}`}
                    disabled={!online}
                  />
                </Field>
                <Btn
                  disabled={payNum <= 0 || busy || !online}
                  onClick={() =>
                    void run(
                      async () => {
                        await api.markReturn(bookId, ret.id, {
                          status: 'DONE',
                          amountVnd: payNum,
                        });
                        onToast(
                          fadeOnly
                            ? `Đã ghi đã đi lại cho ${entry.personName}.`
                            : `Đã đánh dấu đã trả cho ${entry.personName}.`,
                          {
                            label: 'Hoàn tác',
                            run: () => undoReturn(ret.id),
                          },
                        );
                      },
                      fadeOnly ? 'Chưa ghi được đi lại' : 'Chưa ghi được trả lễ',
                    )
                  }
                >
                  {fadeOnly ? 'Xác nhận đã đi lại' : 'Xác nhận đã trả'}
                </Btn>
              </div>
              <div className="mt-2">
                <QuickAmounts onPick={(v) => setPayTouched(String(v))} />
              </div>
              {payNum > 0 ? (
                <p className="mt-2 text-sm text-muted" aria-live="polite">
                  {fadeOnly
                    ? payNum < received
                      ? `Đi lại ${money(payNum)} trong ${money(received)} đã nhận — phần còn lại ${money(received - payNum)} vẫn ở khoản chờ đi lại.`
                      : payNum > received
                        ? `Đi lại ${money(payNum)}, nhiều hơn ${money(received)} đã nhận — phần hơn ${money(payNum - received)} được ghi riêng để nhà mình nhớ.`
                        : `Đi lại ${money(payNum)} — sổ sẽ ghi nhà mình đã đi lại đủ cho ${entry.personName}.`
                    : returnConsequence(payNum, received, entry.personName)}
                </p>
              ) : null}
              <div className="mt-2">
                <Btn
                  variant="ghost"
                  disabled={busy || !online}
                  onClick={() =>
                    void run(async () => {
                      await api.markReturn(bookId, ret.id, { status: 'SKIPPED' });
                      onToast(
                        fadeOnly
                          ? `Đã bỏ qua khoản đi lại cho ${entry.personName}.`
                          : `Đã bỏ qua khoản trả lễ cho ${entry.personName}.`,
                        {
                          label: 'Hoàn tác',
                          run: () => undoReturn(ret.id),
                        },
                      );
                    }, 'Chưa bỏ qua được')
                  }
                >
                  {fadeOnly ? 'Bỏ qua khoản đi lại này' : 'Bỏ qua khoản trả lễ này'}
                </Btn>
              </div>
            </>
          ) : ret.status === 'DONE' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">
                {fadeOnly ? 'Đã đi lại' : 'Đã trả'}{' '}
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
              <p className="text-sm text-muted">
                {fadeOnly ? 'Đã bỏ qua đi lại cho khoản này.' : 'Đã bỏ qua trả lễ cho khoản này.'}
              </p>
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
                  // B1: lưu THÀNH CÔNG thì đóng form sửa (trước đây form đứng
                  // mở sau lưu). Chỉ đặt ở đây — sau await thành công — nên khi
                  // lưu THẤT BẠI (run bắt lỗi) form vẫn mở nguyên để sửa lại.
                  setEditing(false);
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
          role="alertdialog"
          aria-label="Xác nhận xoá khoản"
          aria-describedby={deleteDescId}
          className="mt-3 rounded-[10px] border border-lacquer bg-card px-3 py-3"
        >
          <p id={deleteDescId} className="text-sm">
            Xoá khoản <span className="font-mono font-semibold">{money(entry.amountVnd)}</span> của{' '}
            {entry.personName}?{' '}
            {fadeOnly
              ? 'Khoản đi lại gắn với khoản này cũng bị huỷ.'
              : 'Khoản trả lễ gắn với khoản này cũng bị huỷ.'}
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
