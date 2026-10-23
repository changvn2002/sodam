'use client';

import { useEffect, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamReturnItem } from '../api/types';
import { sourceLabel } from '../lib/lexicon';
import {
  buildPeopleSummaries,
  personAccessibleLabel,
  returnStateLabel,
  type PersonSummary,
} from '../lib/people-summary';
import { Btn, EmptyLedger, Sheet } from '../shell';
import { PersonAvatar } from '../ui/avatar';
import { Plus } from 'lucide-react';
import { friendlyError, money } from '../app-shared';

/* ------------------------------------------------------------------ */
/* Mặt Người: tổng hợp qua lại + đám gần nhất + sheet chi tiết.       */
/* ------------------------------------------------------------------ */

type PersonAggregate = PersonSummary;

export function PeopleFace({
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
        // MEDIUM Panel #03: trang Người PHẢI tính cả trả lễ. Nguồn client:
        // api.listReturns(bookId) — DONE mang số thực trả, OPEN mang số chờ.
        // Lỗi tải trả lễ không được làm sập mặt Người: rơi về [] (hành vi cũ
        // cho hai cột khoản) thay vì mất cả danh sách.
        const returns = await api.listReturns(bookId).catch(() => [] as SodamReturnItem[]);
        setRows(buildPeopleSummaries({ people, details, returns, bookId }));
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
                aria-label={personAccessibleLabel(r, money)}
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
                  {r.returnState !== 'none' ? (
                    <span className="mt-0.5 block truncate text-xs font-medium text-muted">
                      Trả lễ: {returnStateLabel(r.returnState)}
                      {r.returnedPaid > 0 ? ` · đã trả ${money(r.returnedPaid)}` : ''}
                      {r.pendingReturn > 0 ? ` · còn chờ ${money(r.pendingReturn)}` : ''}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] whitespace-nowrap">
                    <span className="text-xs text-muted">Nhận </span>
                    <span className="font-mono font-medium tabular-nums">+{money(r.received)}</span>
                  </span>
                  <span className="block text-[13px] whitespace-nowrap text-ink">
                    <span className="text-xs text-muted">Đi đám </span>
                    <span className="font-mono font-medium tabular-nums">
                      −{money(r.attendedGiven)}
                    </span>
                  </span>
                  {r.returnedPaid > 0 ? (
                    <span className="block text-[13px] whitespace-nowrap text-ink">
                      <span className="text-xs text-muted">Trả lễ </span>
                      <span className="font-mono font-medium tabular-nums">
                        −{money(r.returnedPaid)}
                      </span>
                    </span>
                  ) : null}
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
            <dl className="space-y-1.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-muted">Đã nhận lễ (ở đám nhà mình tổ chức)</dt>
                <dd className="font-mono font-semibold text-ink">{money(selected.received)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-muted">Đã đi đám (ở đám nhà mình đi dự)</dt>
                <dd className="font-mono font-semibold text-ink">
                  {money(selected.attendedGiven)}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-muted">Đã trả lễ (số thực đã trả)</dt>
                <dd className="font-mono font-semibold text-ink">
                  {money(selected.returnedPaid)}
                  {selected.overReturned > 0 ? ` (Trả dư ${money(selected.overReturned)})` : ''}
                </dd>
              </div>
              {selected.pendingReturn > 0 ? (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-muted">Còn chờ trả lễ</dt>
                  <dd className="font-mono font-semibold text-ink">
                    {money(selected.pendingReturn)}
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line pt-1.5">
                <dt className="font-medium text-ink">
                  Chênh sau trả lễ và đi đám (nhận − đi đám − đã trả lễ)
                </dt>
                <dd className="font-mono font-semibold text-ink">{money(selected.balance)}</dd>
              </div>
              <p className="pt-1 text-sm text-muted">
                Trạng thái trả lễ:{' '}
                <span className="font-medium text-ink">
                  {returnStateLabel(selected.returnState)}
                </span>
              </p>
            </dl>
            {selected.returnItems.length > 0 ? (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {selected.returnItems.map((r) => (
                  <li
                    key={r.id}
                    className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {r.fromEventTitle ?? 'Khoản trả lễ'}
                      </span>
                      <span className="block text-xs text-muted">
                        Trả lễ ·{' '}
                        {returnStateLabel(
                          r.status === 'DONE'
                            ? (r.overGivenVnd ?? 0) > 0
                              ? 'overpaid'
                              : 'paid'
                            : r.status === 'OPEN'
                              ? 'pending'
                              : 'skipped',
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">
                      {r.status === 'DONE'
                        ? money(r.returnedAmountVnd ?? r.doneAmountVnd ?? 0)
                        : money(r.receivedAmountVnd ?? r.suggestedAmountVnd ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
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
