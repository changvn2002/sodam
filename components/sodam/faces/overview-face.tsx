'use client';

import { useEffect, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEvent, SodamReturnItem } from '../api/types';
import { cn } from '@/lib/utils';
import { kindLabel } from '../lib/event-kinds';
import { GROUP_STYLE, lexiconForKind } from '../lib/lexicon';
import { Btn, EmptyLedger, StatusPill } from '../shell';
import { KindIcon } from '../ui/kind-icon';
import { LedgerRow } from '../ui/ledger-row';
import { Plus } from 'lucide-react';
import { eventDateLabels, friendlyError, money } from '../app-shared';

/* ------------------------------------------------------------------ */
/* Mặt Tổng quan: bảng đám + 5 khoản chờ trả lễ đầu.                   */
/* ------------------------------------------------------------------ */

export function OverviewFace({
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
        <div className="mt-3 rounded-[7px] border border-line bg-card">
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
        <ul className="mt-3 shrink-0 divide-y divide-line overflow-y-auto border-y border-line">
          {/* W4-3 (Panel final R3, ghế 3): bỏ HỘP VIỀN bao quanh khối
              «Đám của sổ» — khối đứng trần theo kỷ luật sổ kẻ: chỉ kẻ
              ngang trên/dưới + kẻ phân cách giữa các hàng như các khối
              khác, không viền dọc, không bo góc, không nền thẻ.
              W3 (phát sinh khi chụp round-3): hàng Chờ trả cao lên theo
              cấu trúc mới (W3-2) làm tổng nội dung vượt khung — ul này
              có overflow-y-auto nên bị flex co về 0 và biến mất khỏi
              màn Tổng quan 390. shrink-0 (ở class trên): danh sách đám
              không bao giờ tự co; phần vượt khung do vùng cuộn ngoài
              của mặt đảm nhiệm. */}
          {events.map((e) => {
            const dates = eventDateLabels(e.occurredOn);
            const lex = lexiconForKind(e.kind);
            const isHosted = e.role === 'HOSTED';
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(e.id)}
                  className="flex min-h-14 w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
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
                    {/* W4-1 / F-1 BLOCKING (Panel final R3, ghế 1 + ghế 4):
                        dòng TIÊU ĐỀ + TIỀN là một hàng riêng; META xuống
                        thành khối riêng trọn bề ngang dưới hàng đó (đúng
                        kỷ luật detail đã duyệt ở W3-3) — bỏ hẳn truncate:
                        ngày + số khách/viếng hiện TRỌN ở mọi khổ, không
                        còn bị cột tiền cắt cụt giữa ký tự. */}
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-medium text-ink">
                        {/* F16: bỏ chấm đen đứng cạnh icon (hai dấu cho một
                            hàng) — trạng thái đang ghi nói bằng CHỮ kế bên
                            tên đám + sr-only, icon giữ một hệ duy nhất. */}
                        {e.id === openEventId ? <span className="sr-only">Đang ghi: </span> : null}
                        <span className="min-w-0 [overflow-wrap:anywhere]">{e.title}</span>
                        {e.id === openEventId ? (
                          <span className="shrink-0 text-xs font-medium text-muted">Đang ghi</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                        {isHosted ? 'Nhận ' : 'Đi '}
                        {money(e.totalAmountVnd ?? 0)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
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
          {/* F10: khối chờ là MỘT KHỐI KẺ LIỀN (kẻ trên/dưới + kẻ
              ngang giữa các dòng) như bản 1440 — không thẻ rời ở 390. */}
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {pending.slice(0, 5).map((r) => {
              // F3: khoản từ đám tang/giỗ không mang badge «Chờ trả» —
              // gọi là «Chưa đi lại» theo lexicon của chính đám đó.
              const fromEvent = events.find((e) => e.id === r.fromEventId);
              const fromGroup = fromEvent ? lexiconForKind(fromEvent.kind).group : 'neutral';
              const solemnLike = fromGroup === 'solemn' || fromGroup === 'memorial';
              return (
                <li key={r.id}>
                  <LedgerRow
                    name={r.personName ?? r.personId}
                    personId={r.personId}
                    amountLabel={money(r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0)}
                    meta={r.fromEventTitle ?? undefined}
                    trailing={
                      <StatusPill
                        status="OPEN"
                        label={solemnLike ? 'Chưa đi lại' : undefined}
                        accentDot={!solemnLike && fromGroup === 'celebratory'}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
