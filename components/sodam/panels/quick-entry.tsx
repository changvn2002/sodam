'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamEvent, SodamParseResult, SodamPerson } from '../api/types';
import { cn } from '@/lib/utils';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../lib/draft-store';
import { kindLabel } from '../lib/event-kinds';
import { GROUP_STYLE, groupOfKind, lexiconForKind } from '../lib/lexicon';
import { Btn, Field, Input, Sheet } from '../shell';
import { KindIcon } from '../ui/kind-icon';
import { Mic, Plus } from 'lucide-react';
import {
  formatAmountInput,
  friendlyError,
  money,
  QuickAmounts,
  type GhostEntry,
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
  // F1: QuickEntry KHÔNG bắn toast nữa — xác nhận sau lưu là màn tại
  // chỗ duy nhất trong chính composer (xem savedInfo).
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
  // F1 (Panel R1): sau khi lưu, composer chuyển hẳn sang MỘT màn xác
  // nhận duy nhất (không toast chồng banner, không form trắng + «Sẽ
  // ghi:» ở thì tương lai đứng cạnh thông báo đã lưu).
  const [savedInfo, setSavedInfo] = useState<{
    name: string;
    amount: number;
    eventTitle: string;
    sentence: string;
    newTotal: number | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  /* W2 (PWA-FIX, mục 6.2 + 6.6 + PWA-31): nháp ghi khoản bền theo
     bookId ở localStorage. Có nội dung (tên hoặc số tiền) và chưa lưu
     → tự lưu nháp; mở lại composer → khôi phục, CHỈ khi đám trong
     nháp còn tồn tại trong `events`. Lưu thành công (online lẫn
     offline-enqueue) → xoá nháp. Nhờ persist, đóng sheet bằng X khi
     còn nháp không còn mất lặng — mở lại là thấy nháp, nên KHÔNG thêm
     confirm dialog. Effect persist bỏ qua lần chạy đầu lúc mount để
     không ghi đè nháp trước khi khôi phục. */
  const entryDraftKey = draftKey('quick-entry', bookId);
  const persistArmedRef = useRef(false);

  useEffect(() => {
    const saved = loadDraft<{
      eventId?: unknown;
      name?: unknown;
      amount?: unknown;
      mode?: unknown;
    }>(entryDraftKey);
    if (saved && typeof saved.eventId === 'string') {
      const ev = events.find((e) => e.id === saved.eventId);
      if (ev) {
        setEvent(ev);
        if (typeof saved.name === 'string') setName(saved.name);
        if (typeof saved.amount === 'string') setAmount(saved.amount);
        if (saved.mode === 'manual' || saved.mode === 'voice') setMode(saved.mode);
      }
    }
    // Chỉ chạy lúc mount — composer được mount mới mỗi lần mở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!persistArmedRef.current) {
      persistArmedRef.current = true;
      return;
    }
    if (savedInfo || queuedNote) return;
    const hasContent = name.trim() !== '' || amount !== '';
    if (!hasContent) {
      clearDraft(entryDraftKey);
      return;
    }
    saveDraft(entryDraftKey, { eventId: event?.id ?? null, name, amount, mode });
  }, [entryDraftKey, event, name, amount, mode, savedInfo, queuedNote]);

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
    return people
      .filter((p) => {
        const dn = p.displayName.trim().toLowerCase();
        // W3-10/L-2 (ghế 4): bỏ ECHO — người mà tên đã gõ TRỌN trong ô
        // không hiện lại nguyên văn ngay dưới ô như máy lặp lại; hàng
        // gợi ý chỉ còn người khác khớp một phần.
        if (q && dn === q) return false;
        return !q || dn.includes(q);
      })
      .slice(0, 6);
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
        // Đã vào hàng chờ = đã ghi — xoá nháp (W2).
        clearDraft(entryDraftKey);
        setQueuedNote(true);
        onSaved();
        return;
      }
      const savedName = name.trim();
      const savedAmount = amountNum;
      const savedSentence = lex.savedToast(savedName);
      await api.createEntry(bookId, event.id, {
        personName: savedName,
        amountVnd: savedAmount,
        source,
        rawText: source === 'VOICE' ? transcript || undefined : undefined,
      });
      // Lưu thành công → xoá nháp (W2).
      clearDraft(entryDraftKey);
      // F1: KHÔNG toast nữa — xác nhận duy nhất là màn «Đã ghi vào sổ»
      // bên dưới (câu xác nhận theo giọng đám của lexicon được giữ làm
      // câu chính của màn đó). Tổng MỚI của đám lấy lại từ máy chủ để
      // người ghi đối chiếu ngay, như dòng vừa xuống sổ giấy.
      let newTotal: number | null = null;
      try {
        const detail = await api.getEvent(bookId, event.id);
        newTotal = detail.totalAmountVnd ?? null;
      } catch {
        newTotal = null;
      }
      setSavedInfo({
        name: savedName,
        amount: savedAmount,
        eventTitle: event.title,
        sentence: savedSentence,
        newTotal,
      });
      onSaved();
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
      ) : savedInfo ? (
        /* F1: MÀN XÁC NHẬN DUY NHẤT sau khi lưu — khoản vừa ghi nằm
           nguyên như một dòng sổ (người · số tiền · đám · tổng mới),
           không form trống, không «Sẽ ghi:», không toast chồng. Đóng
           bằng «Xong»; ghi tiếp là hành động phụ rõ ràng. */
        <div className="space-y-4">
          <div role="status">
            <p className="text-[17px] font-bold text-ink">Đã ghi vào sổ</p>
            <p className="mt-1 text-sm font-medium text-ink">{savedInfo.sentence}</p>
          </div>
          <dl className="divide-y divide-line border-y border-line text-sm">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="font-medium text-muted">Người vừa ghi</dt>
              <dd className="font-semibold text-ink">{savedInfo.name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="font-medium text-muted">Số tiền</dt>
              <dd className="font-mono text-[15px] font-bold tabular-nums">
                {money(savedInfo.amount)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="font-medium text-muted">Vào đám</dt>
              <dd className="text-right font-semibold [overflow-wrap:anywhere] text-ink">
                {savedInfo.eventTitle}
              </dd>
            </div>
            {savedInfo.newTotal != null ? (
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="font-medium text-muted">Tổng mới của đám</dt>
                <dd className="font-mono text-[15px] font-bold tabular-nums">
                  {money(savedInfo.newTotal)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm text-muted">
            Khoản này đã nằm trong danh sách của đám — đóng lại là thấy ngay dòng vừa ghi.
          </p>
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setSavedInfo(null);
                setName('');
                setAmount('');
                setTranscript('');
                setVoiceNote(null);
                setNameError(null);
                setAmountError(null);
                nameRef.current?.focus();
              }}
            >
              Ghi khoản tiếp
            </Btn>
            <Btn className="flex-1" onClick={onClose}>
              Xong
            </Btn>
          </div>
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
          {/* W3-5 (Recheck R2, ghế 3): toggle «Gõ tay / Giọng nói» bỏ
              dạng segmented-pill template (khay xám bo tròn + viên trắng
              nổi bóng) — vẽ lại theo NGÔN NGỮ SỔ như hàng chọn số tiền:
              hai ô trần ngăn bằng kẻ dọc trên đường kẻ ngang, ô đang
              chọn = chữ đậm + gạch mực ở chân ô. */}
          <div
            role="tablist"
            aria-label="Cách ghi khoản"
            className="flex divide-x divide-line border-y border-line"
          >
            {[
              { id: 'manual', label: 'Gõ tay' },
              { id: 'voice', label: 'Giọng nói' },
            ].map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(opt.id)}
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

          {/* B′ mục 5: form vẽ trong thế giới DÒNG KẺ — trường là một dòng
              kẻ có nhãn mono phía trên, không hộp bo góc kiểu iOS. */}
          <Field label={lex!.nameFieldLabel} error={nameError}>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ tên"
              autoComplete="off"
              className="rounded-none border-0 border-b border-line-strong px-0 shadow-none focus:border-indigo-500 focus:ring-0"
            />
          </Field>
          {/* F12: gợi ý tên cũng về HÀNG KẺ — tên trần ngăn bằng kẻ dọc,
              không pill. */}
          {suggestions.length > 0 ? (
            <div
              className="flex flex-wrap divide-x divide-line border-y border-line"
              role="group"
              aria-label="Người đã có trong sổ"
            >
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setName(p.displayName)}
                  className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
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
              // F12: ký hiệu ₫ hiện TẠI CHỖ trong ô tiền lớn, kể cả khi
              // đã có số (trước đây chỉ placeholder mới có ₫).
              value={amount ? `${formatAmountInput(amount)}₫` : ''}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0₫"
              className="rounded-none border-0 border-b-2 border-indigo-500 px-0 font-mono text-[32px] font-semibold shadow-none focus:ring-0"
            />
          </Field>
          <p className="-mt-2 text-[13px] text-muted">Cứ nhập số, sổ tự thêm dấu chấm và ₫.</p>
          <QuickAmounts onPick={(v) => setAmount(String(v))} />

          {/* F1: thanh dưới form chỉ còn MỘT nút lưu duy nhất. «Xong»
              gây lẫn (tưởng đã lưu) bị bỏ khỏi đây — đóng form chưa lưu
              bằng nút đóng (×) trên đầu hộp; «Xong» chỉ xuất hiện ở màn
              xác nhận SAU khi đã lưu. Dòng đọc lại «Sẽ ghi:» ở thì tương
              lai chỉ sống ở trạng thái CHƯA lưu này. */}
          <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-line bg-card px-1 pt-3 pb-1">
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
            <Btn className="shrink-0" disabled={busy} onClick={() => void save()}>
              {lex!.saveLabel}
            </Btn>
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
