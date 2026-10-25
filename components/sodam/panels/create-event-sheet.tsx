'use client';

import { useEffect, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEvent, SodamEventKind, SodamEventRole } from '../api/types';
import { cn } from '@/lib/utils';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../lib/draft-store';
import { EVENT_KIND_LABELS, EVENT_KIND_ORDER, kindLabel } from '../lib/event-kinds';
import { GROUP_STYLE, groupOfKind } from '../lib/lexicon';
import { Btn, Field, Input, SegmentedTabs, Sheet } from '../shell';
import { KindIcon } from '../ui/kind-icon';
import { eventDateLabels, friendlyError } from '../app-shared';

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

export function CreateEventSheet({
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

  /* W2 (PWA-FIX, cùng chuẩn PWA-31): nháp tạo đám bền theo bookId ở
     localStorage — {title, kind, role, date} khác mặc định thì tự lưu,
     mở lại sheet thì khôi phục, tạo thành công thì xoá nháp. Sheet này
     luôn mounted (chỉ ẩn bằng `open`) nên khôi phục chạy khi `open`
     bật; effect persist bỏ qua lần chạy đầu sau khi mở để không ghi
     đè nháp trước lúc khôi phục. */
  const eventDraftKey = draftKey('create-event', bookId);
  const initialDateRef = useRef(date);
  const persistArmedRef = useRef(false);
  // Sau khi tạo thành công: chặn persist ghi lại nháp vừa xoá trong
  // lúc state reset (title='') chạy trước khi sheet kịp đóng.
  const justCreatedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    justCreatedRef.current = false;
    const saved = loadDraft<{
      title?: unknown;
      kind?: unknown;
      role?: unknown;
      date?: unknown;
    }>(eventDraftKey);
    if (saved) {
      if (typeof saved.title === 'string') setTitle(saved.title);
      if (
        typeof saved.kind === 'string' &&
        (EVENT_KIND_ORDER as string[]).includes(saved.kind)
      ) {
        setKind(saved.kind as SodamEventKind);
      }
      if (saved.role === 'HOSTED' || saved.role === 'ATTENDED') setRole(saved.role);
      if (typeof saved.date === 'string' && saved.date) setDate(saved.date);
    }
    // Khôi phục mỗi lần sheet mở; eventDraftKey đổi theo bookId.
  }, [open, eventDraftKey]);

  useEffect(() => {
    if (!open) return;
    if (justCreatedRef.current) return;
    if (!persistArmedRef.current) {
      persistArmedRef.current = true;
      return;
    }
    const hasContent =
      title.trim() !== '' ||
      kind !== 'CUOI' ||
      role !== 'HOSTED' ||
      date !== initialDateRef.current;
    if (!hasContent) {
      clearDraft(eventDraftKey);
      return;
    }
    saveDraft(eventDraftKey, { title, kind, role, date });
  }, [open, eventDraftKey, title, kind, role, date]);

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
      // Tạo thành công → xoá nháp (W2).
      justCreatedRef.current = true;
      clearDraft(eventDraftKey);
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
