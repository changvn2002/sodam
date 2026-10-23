'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEventKind, SodamPerson, SodamRelation, SodamRelationType } from '../api/types';
import { cn } from '@/lib/utils';
import { groupOfKind, relationOrderForGroup } from '../lib/lexicon';
import { Btn, EmptyLedger, Field, Select, Sheet } from '../shell';
import { PersonAvatar } from '../ui/avatar';
import { Plus, Trash2 } from 'lucide-react';
import { friendlyError, RELATION_LABELS, type PushToast } from '../app-shared';

/* ------------------------------------------------------------------ */
/* Mặt Cây họ: khung cuộn 2 chiều + gắn/xoá quan hệ (xoá có hoàn tác).*/
/* ------------------------------------------------------------------ */

export function TreeFace({
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
  const deleteDescId = useId();
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
            variant={contextGroup === 'solemn' || contextGroup === 'memorial' ? 'solemn' : 'ledger'}
            title="Chưa có ai trong sổ"
            body="Ghi khoản đầu tiên — mỗi người được ghi sẽ hiện ở đây để gắn quan hệ."
          />
        </div>
      ) : (
        <div
          className={cn(
            'mt-4 overflow-auto rounded-xl border border-line bg-card p-4',
            relations.length === 0 ? 'flex min-h-[42dvh] flex-col justify-center' : 'max-h-[58dvh]',
          )}
        >
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
                    role="alertdialog"
                    aria-label="Xác nhận xoá quan hệ"
                    aria-describedby={deleteDescId}
                    className="mt-2 rounded-[10px] border border-lacquer bg-card px-3 py-3"
                  >
                    <p id={deleteDescId} className="text-sm">
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
