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
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium text-ink">
                      {e.id === openEventId ? (
                        <>
                          {/* B5: chấm token CSS + nhãn truy cập được thay ký tự chấm thô U+25CF. */}
                          <span
                            className="size-2 shrink-0 rounded-full bg-indigo-700"
                            role="img"
                            aria-label="Đang ghi"
                            title="Đang ghi"
                          />
                          <span className="sr-only">Đang ghi: </span>
                        </>
                      ) : null}
                      <span className="min-w-0 truncate">{e.title}</span>
                      {e.id === openEventId ? (
                        <span className="shrink-0 text-xs font-medium text-muted">Đang ghi</span>
                      ) : null}
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
