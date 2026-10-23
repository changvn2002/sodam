'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEvent, SodamReturnItem } from '../api/types';
import { nextReturnPay } from '../lib/return-pay';
import { Btn, EmptyLedger, Field, Input, SegmentedTabs, StatusPill } from '../shell';
import { LedgerRow } from '../ui/ledger-row';
import { Undo2 } from 'lucide-react';
import {
  formatAmountInput,
  friendlyError,
  money,
  QuickAmounts,
  returnConsequence,
  type PushToast,
} from '../app-shared';

/* ------------------------------------------------------------------ */
/* Mặt Trả lễ: dải tổng mini + lọc 4 mục + hàng mở cùng câu hệ quả.   */
/* ------------------------------------------------------------------ */

export function ReturnsFace({
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
  // B2: bám theo tổng vừa sửa khi panel đang mở, trừ khi đã sửa tay.
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
            onChange={(e) => setPayTouched(e.target.value.replace(/\D/g, ''))}
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
        <QuickAmounts onPick={(v) => setPayTouched(String(v))} />
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
