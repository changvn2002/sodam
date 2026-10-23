'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEvent, SodamParseResult, SodamPerson } from '../api/types';
import { cn } from '@/lib/utils';
import { kindLabel } from '../lib/event-kinds';
import { GROUP_STYLE, groupOfKind, lexiconForKind } from '../lib/lexicon';
import { Btn, Field, Input, SegmentedTabs, Sheet } from '../shell';
import { KindIcon } from '../ui/kind-icon';
import { Mic, Plus } from 'lucide-react';
import {
  formatAmountInput,
  friendlyError,
  money,
  QuickAmounts,
  type GhostEntry,
  type PushToast,
} from '../app-shared';

/* ------------------------------------------------------------------ */
/* Composer ghi khoản phổ quát (§6): 2 mode Gõ tay | Giọng nói.       */
/* ------------------------------------------------------------------ */

export function QuickEntry({
  api,
  bookId,
  events,
  initialEvent,
  online,
  enqueue,
  onEnqueued,
  onClose,
  onSaved,
  onToast,
  onCreateEvent,
}: {
  api: SodamApi;
  bookId: string;
  events: SodamEvent[];
  initialEvent: SodamEvent | null;
  online: boolean;
  enqueue: (bookId: string, type: string, payload: Record<string, unknown>) => void;
  onEnqueued: (ghost: GhostEntry) => void;
  onClose: () => void;
  onSaved: () => void;
  onToast: PushToast;
  onCreateEvent: () => void;
}) {
  const [event, setEvent] = useState<SodamEvent | null>(initialEvent);
  const lex = event ? lexiconForKind(event.kind) : null;
  const [mode, setMode] = useState('manual');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [people, setPeople] = useState<SodamPerson[]>([]);
  const [queuedNote, setQueuedNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recogRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    void api
      .listPeople(bookId)
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [api, bookId]);

  useEffect(
    () => () => {
      try {
        recogRef.current?.stop();
      } catch {
        // Đã dừng rồi — bỏ qua.
      }
    },
    [],
  );

  const amountNum = Number(amount.replace(/\D/g, '')) || 0;
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    return people.filter((p) => !q || p.displayName.toLowerCase().includes(q)).slice(0, 6);
  }, [people, name]);

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleUtterance = async (text: string) => {
    setTranscript(text);
    try {
      const parsed: SodamParseResult = await api.parseUtterance(bookId, text);
      if (parsed.name) setName(parsed.name);
      if (parsed.amountVnd != null) setAmount(String(parsed.amountVnd));
      setVoiceNote(parsed.speakBack);
      speak(parsed.speakBack);
    } catch (e) {
      setVoiceNote(friendlyError(e, 'Chưa nghe rõ — đọc lại hoặc chuyển sang Gõ tay.'));
    }
  };

  const toggleListen = () => {
    if (listening) {
      try {
        recogRef.current?.stop();
      } catch {
        // bỏ qua
      }
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    type SpeechRec = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult:
        | ((ev: {
            resultIndex: number;
            results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void)
        | null;
      onend: (() => void) | null;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceNote('Trình duyệt này không hỗ trợ ghi bằng giọng nói — dùng Gõ tay vẫn được.');
      return;
    }
    const recog = new SR();
    recog.lang = 'vi-VN';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (ev) => {
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) void handleUtterance(finalText.trim());
    };
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  };

  const save = async () => {
    if (!event || !lex) return;
    let ok = true;
    if (!name.trim()) {
      setNameError('Chưa nhập tên — gõ tên hoặc chọn một người bên dưới.');
      ok = false;
    } else setNameError(null);
    if (amountNum <= 0) {
      setAmountError('Chưa nhập số tiền — chạm một mức bên dưới hoặc gõ số tiền.');
      ok = false;
    } else setAmountError(null);
    if (!ok) {
      if (!name.trim()) nameRef.current?.focus();
      else amountRef.current?.focus();
      return;
    }
    const source = mode === 'voice' ? 'VOICE' : 'MANUAL';
    setBusy(true);
    try {
      if (!online) {
        enqueue(bookId, 'createEntry', {
          eventId: event.id,
          personName: name.trim(),
          amountVnd: amountNum,
          source,
        });
        onEnqueued({
          eventId: event.id,
          personName: name.trim(),
          amountVnd: amountNum,
          source,
        });
        setQueuedNote(true);
        onSaved();
        return;
      }
      await api.createEntry(bookId, event.id, {
        personName: name.trim(),
        amountVnd: amountNum,
        source,
        rawText: source === 'VOICE' ? transcript || undefined : undefined,
      });
      onToast(lex.savedToast(name.trim()));
      onSaved();
      // B3 (Panel #03 / R3 MINOR, H7): GIỮ composer mở sau khi lưu thành
      // công — luồng chính của sổ đám là ghi LIÊN TIẾP nhiều khoản tại đám;
      // đóng sau mỗi khoản bắt người ghi mở lại từ đầu. Reset tên/tiền về
      // trống (giữ §1.7: ô tiền trống mặc định, không số điền sẵn), focus về
      // ô tên để ghi khoản tiếp; đóng hẳn bằng nút "Xong" / nút đóng sheet.
      setName('');
      setAmount('');
      setTranscript('');
      setVoiceNote(null);
      setNameError(null);
      setAmountError(null);
      nameRef.current?.focus();
    } catch (e) {
      setAmountError(friendlyError(e, 'Chưa lưu được khoản — thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const title = event && lex ? `${lex.entryVerb} — ${event.title}` : 'Ghi khoản';

  return (
    <Sheet open title={title} onClose={onClose}>
      {queuedNote ? (
        <div className="space-y-4">
          <p role="status" className="rounded-[10px] bg-indigo-50 px-3 py-3 text-sm font-medium">
            Đã lưu vào hàng chờ trên máy này — sẽ tự gửi khi có mạng.
          </p>
          <Btn className="w-full" onClick={onClose}>
            Xong
          </Btn>
        </div>
      ) : !event ? (
        <div className="space-y-3">
          {events.length === 0 ? (
            <>
              <p className="text-sm text-muted">
                Sổ chưa có đám nào — tạo đám trước rồi ghi khoản vào đám đó.
              </p>
              <Btn className="w-full" onClick={onCreateEvent}>
                <Plus className="size-4" aria-hidden /> Tạo đám
              </Btn>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Chọn đám để ghi khoản</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {events.map((e) => {
                  const style = GROUP_STYLE[groupOfKind(e.kind)];
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEvent(e)}
                        className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                      >
                        <span className={cn('shrink-0', style.accentText)}>
                          <KindIcon kind={e.kind} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                        <span className="shrink-0 text-xs text-muted">{kindLabel(e.kind)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Btn variant="secondary" className="w-full" onClick={onCreateEvent}>
                <Plus className="size-4" aria-hidden /> Tạo đám mới
              </Btn>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <SegmentedTabs
            ariaLabel="Cách ghi khoản"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'manual', label: 'Gõ tay' },
              { id: 'voice', label: 'Giọng nói' },
            ]}
          />

          {mode === 'voice' ? (
            <div className="space-y-3">
              <Btn
                className="min-h-12 w-full"
                variant={listening ? 'danger' : 'primary'}
                onClick={toggleListen}
              >
                <Mic className="size-4" aria-hidden />
                {listening ? 'Dừng nghe' : 'Bấm để nói'}
              </Btn>
              <p className="text-sm text-muted">
                Ghi miệng trước, sửa sau. Tiền chỉ lưu khi bạn bấm Lưu.
              </p>
              {transcript ? (
                <p className="rounded-[10px] border border-line bg-paper px-3 py-2.5 text-sm">
                  <span className="text-xs font-medium text-muted">Vừa nghe: </span>
                  {transcript}
                </p>
              ) : null}
              {voiceNote ? (
                <p role="status" className="text-sm font-medium text-indigo-700">
                  {voiceNote}
                </p>
              ) : null}
              {voiceNote?.includes('không hỗ trợ') ? (
                <Btn variant="secondary" onClick={() => setMode('manual')}>
                  Chuyển sang Gõ tay
                </Btn>
              ) : null}
            </div>
          ) : null}

          <Field label={lex!.nameFieldLabel} error={nameError}>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ tên"
              autoComplete="off"
            />
          </Field>
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Người đã có trong sổ">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setName(p.displayName)}
                  className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-card px-3 text-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {p.displayName}
                </button>
              ))}
            </div>
          ) : null}

          <Field label={lex!.amountFieldLabel} error={amountError}>
            <Input
              ref={amountRef}
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0 ₫"
            />
          </Field>
          <QuickAmounts onPick={(v) => setAmount(String(v))} />

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 text-sm text-muted" aria-live="polite">
              {name.trim() && amountNum > 0 ? (
                <>
                  Sẽ ghi: <span className="font-medium text-ink">{name.trim()}</span> —{' '}
                  <span className="font-mono font-semibold text-ink">{money(amountNum)}</span>
                  {lex!.reviewNoun ? ` ${lex!.reviewNoun}` : ''}
                </>
              ) : (
                'Sẽ ghi: …'
              )}
            </p>
            <span className="flex shrink-0 gap-2">
              <Btn variant="secondary" onClick={onClose}>
                Xong
              </Btn>
              <Btn disabled={busy} onClick={() => void save()}>
                {lex!.saveLabel}
              </Btn>
            </span>
          </div>
          {!online ? (
            <p className="text-sm text-muted">
              Đang offline — khoản sẽ lưu vào hàng chờ trên máy này và tự gửi khi có mạng.
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
