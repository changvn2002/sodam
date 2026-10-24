'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEventKind, SodamPerson, SodamRelation, SodamRelationType } from '../api/types';
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
  // F4: xoá quan hệ CHA MẸ cần nấc xác nhận nặng hơn — phải tự tay
  // đánh dấu «đã hiểu» mới mở nút xoá (xem hộp xác nhận bên dưới).
  const [parentAck, setParentAck] = useState(false);
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

  /* F4 (Panel R1): CÂY HỌ PHẢI LÀ CÂY — xếp người theo THẾ HỆ suy từ
     quan hệ đã ghi: Cha mẹ ở thế hệ trên, con xuống một thế hệ, anh
     chị em / vợ chồng ngang thế hệ. «Ông bà …» là bậc trên cùng, tách
     hẳn một thế hệ riêng dù chưa ghi quan hệ nào cho mục đó (tên gọi
     đã nói rõ bậc). Người chưa có quan hệ nào xếp ở thế hệ nền và ghi
     rõ «chưa ghi quan hệ». */
  const generationOf = (() => {
    const gen = new Map<string, number>(people.map((p) => [p.id, 0]));
    for (let pass = 0; pass < people.length + 1; pass += 1) {
      let changed = false;
      for (const r of relations) {
        const from = gen.get(r.fromPersonId) ?? 0;
        const to = gen.get(r.toPersonId) ?? 0;
        if (r.type === 'PARENT' && to !== from + 1) {
          gen.set(r.toPersonId, from + 1);
          changed = true;
        } else if (r.type === 'CHILD' && from !== to + 1) {
          gen.set(r.fromPersonId, to + 1);
          changed = true;
        } else if (
          (r.type === 'SIBLING' || r.type === 'SPOUSE' || r.type === 'OTHER') &&
          to !== from
        ) {
          const shared = Math.min(from, to);
          gen.set(r.fromPersonId, shared);
          gen.set(r.toPersonId, shared);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const others = people.filter((p) => !/ông bà/i.test(p.displayName));
    const baseMin = others.length > 0 ? Math.min(...others.map((p) => gen.get(p.id) ?? 0)) : 0;
    for (const p of people) {
      if (/ông bà/i.test(p.displayName)) gen.set(p.id, baseMin - 1);
    }
    return gen;
  })();
  const generationGroups = (() => {
    const byGen = new Map<number, SodamPerson[]>();
    for (const p of people) {
      const g = generationOf.get(p.id) ?? 0;
      byGen.set(g, [...(byGen.get(g) ?? []), p]);
    }
    return [...byGen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gen, members]) => ({ gen, members }));
  })();
  const relationPrefix = (type: SodamRelation['type']): string => {
    switch (type) {
      case 'PARENT':
        return 'Cha mẹ của';
      case 'CHILD':
        return 'Con của';
      case 'SIBLING':
        return 'Anh chị em với';
      case 'SPOUSE':
        return 'Vợ chồng với';
      default:
        return 'Họ hàng với';
    }
  };

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
          {people.length} người · {relations.length} quan hệ đã ghi
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setListOpen(true)}>
            Quan hệ đã ghi
          </Btn>
          <Btn disabled={people.length < 2} onClick={() => setAttachOpen(true)}>
            <Plus className="size-4" aria-hidden /> Ghi quan hệ
          </Btn>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="mt-4 rounded-[7px] border border-line bg-card">
          <EmptyLedger
            variant={contextGroup === 'solemn' || contextGroup === 'memorial' ? 'solemn' : 'ledger'}
            title="Chưa có ai trong sổ"
            body="Ghi khoản đầu tiên — mỗi người được ghi sẽ hiện ở đây để ghi quan hệ."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-y-auto border-y border-line">
          {/* Cây thật: từng THẾ HỆ là một tầng riêng, thụt cấp sâu dần
              theo đời, người trong tầng nối xuống quan hệ của mình bằng
              đường kẻ dọc + nhánh ngang. Không chip-cloud. */}
          {generationGroups.map((group, gi) => {
            const hasGrandparents = group.members.some((p) => /ông bà/i.test(p.displayName));
            return (
              <section
                key={group.gen}
                aria-label={`Thế hệ ${gi + 1}`}
                className="border-b border-line py-3 last:border-b-0"
              >
                <h3 className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  Thế hệ {gi + 1}
                  {hasGrandparents ? ' · Ông bà' : gi === 0 ? ' · Bề trên' : ''}
                </h3>
                <ul className="mt-2 space-y-3" style={{ marginLeft: `${gi * 20}px` }}>
                  {group.members.map((p) => {
                    const outgoing = relations.filter((r) => r.fromPersonId === p.id);
                    const incoming = relations.filter((r) => r.toPersonId === p.id);
                    return (
                      <li key={p.id} className="flex gap-3">
                        <PersonAvatar name={p.displayName} seed={p.id} size="md" />
                        <div className="min-w-0 flex-1 border-l-2 border-line pl-3">
                          <p className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere] text-ink">
                            {p.displayName}
                          </p>
                          {outgoing.map((r) => (
                            <p
                              key={r.id}
                              className="mt-1 flex items-baseline gap-2 text-sm text-muted"
                            >
                              <span
                                aria-hidden
                                className="inline-block h-2 w-4 shrink-0 translate-y-[-2px] border-b-2 border-l-2 border-line-strong"
                              />
                              <span>
                                {relationPrefix(r.type)}{' '}
                                <span className="font-medium whitespace-nowrap text-ink">
                                  {nameOf(r.toPersonId)}
                                </span>
                              </span>
                            </p>
                          ))}
                          {incoming
                            .filter((r) => r.type === 'CHILD')
                            .map((r) => (
                              <p
                                key={r.id}
                                className="mt-1 flex items-baseline gap-2 text-sm text-muted"
                              >
                                <span
                                  aria-hidden
                                  className="inline-block h-2 w-4 shrink-0 translate-y-[-2px] border-b-2 border-l-2 border-line-strong"
                                />
                                <span>
                                  Cha mẹ của{' '}
                                  <span className="font-medium whitespace-nowrap text-ink">
                                    {nameOf(r.fromPersonId)}
                                  </span>
                                </span>
                              </p>
                            ))}
                          {outgoing.length === 0 && incoming.length === 0 ? (
                            <p className="mt-0.5 text-xs text-muted">Chưa ghi quan hệ nào.</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {relations.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 py-4">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                {people.length >= 2
                  ? 'Chưa ghi quan hệ nào. Ghi quan hệ để các khoản qua lại tự xếp theo từng nhánh họ.'
                  : 'Cần ít nhất hai người mới ghi được quan hệ — ghi khoản cho thêm một người nữa là ghi được.'}
              </p>
              {people.length >= 2 ? (
                <Btn variant="secondary" onClick={() => setAttachOpen(true)}>
                  <Plus className="size-4" aria-hidden /> Ghi quan hệ đầu tiên
                </Btn>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <Sheet open={attachOpen} title="Ghi quan hệ" onClose={() => setAttachOpen(false)}>
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
                .catch((e: Error) => onError(friendlyError(e, 'Ghi quan hệ lỗi')))
                .finally(() => setBusy(false));
            }}
          >
            Ghi quan hệ
          </Btn>
        </div>
      </Sheet>

      <Sheet open={listOpen} title="Quan hệ đã ghi" onClose={() => setListOpen(false)}>
        {relations.length === 0 ? (
          <EmptyLedger
            title="Chưa có quan hệ nào"
            body="Bấm Ghi quan hệ để nối hai người đầu tiên trong cây họ."
          />
        ) : (
          <ul className="max-h-[56dvh] divide-y divide-line overflow-y-auto rounded-[7px] border border-line">
            {relations.map((r) => (
              <li key={r.id} className="px-3.5 py-2.5 text-sm">
                {/* F15 (Panel R1): tên người KHÔNG bẻ giữa tên («Bác /
                    Bảy») — hàng cho phép xuống dòng GIỮA các khối, tên
                    từng người là một khối không vỡ (whitespace-nowrap). */}
                <div className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1.5">
                  <PersonAvatar name={nameOf(r.fromPersonId)} seed={r.fromPersonId} size="sm" />
                  <span className="font-medium whitespace-nowrap">{nameOf(r.fromPersonId)}</span>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink">
                    {RELATION_LABELS[r.type] ?? r.type}
                  </span>
                  <PersonAvatar name={nameOf(r.toPersonId)} seed={r.toPersonId} size="sm" />
                  <span className="font-medium whitespace-nowrap">{nameOf(r.toPersonId)}</span>
                  <Btn
                    variant="ghost"
                    className="ml-auto shrink-0 text-lacquer hover:bg-lacquer/5"
                    aria-label={`Xoá quan hệ ${RELATION_LABELS[r.type] ?? r.type} giữa ${nameOf(r.fromPersonId)} và ${nameOf(r.toPersonId)}`}
                    onClick={() => {
                      setConfirmRelId(r.id);
                      setParentAck(false);
                    }}
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
                    {/* F4: quan hệ CHA MẸ là việc nặng trong họ — thêm
                        một nấc xác nhận riêng: phải tự tay đánh dấu đã
                        hiểu mới mở được nút xoá. Quan hệ thường giữ
                        một nấc như cũ. Câu trấn an về khoản lễ ở trên
                        giữ nguyên từng chữ. */}
                    {r.type === 'PARENT' ? (
                      <div className="mt-2.5 border-t border-line pt-2.5">
                        <p className="text-sm font-semibold text-ink">
                          Đây là quan hệ cha mẹ — xin cân nhắc thêm một lần.
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Xoá quan hệ này sẽ cắt nhánh cha mẹ — con trong cây họ; muốn nối lại phải
                          ghi lại từ đầu.
                        </p>
                        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
                          <input
                            type="checkbox"
                            checked={parentAck}
                            onChange={(e) => setParentAck(e.target.checked)}
                            className="size-5 shrink-0 accent-[#D1242F]"
                          />
                          Tôi đã hiểu và vẫn muốn xoá quan hệ cha mẹ này
                        </label>
                      </div>
                    ) : null}
                    <div className="mt-2.5 flex gap-2">
                      <Btn
                        variant="danger"
                        disabled={relBusy || (r.type === 'PARENT' && !parentAck)}
                        onClick={() => void removeRelation(r)}
                      >
                        {r.type === 'PARENT' ? 'Xoá hẳn quan hệ cha mẹ' : 'Xoá hẳn'}
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
