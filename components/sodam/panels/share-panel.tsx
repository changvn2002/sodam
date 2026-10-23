'use client';

import { useState } from 'react';
import type { SodamApi } from '../api';
import type { SodamBook } from '../api/types';
import { Btn, formatInviteCode } from '../shell';
import { Check } from 'lucide-react';
import { friendlyError, type PushToast } from '../app-shared';

/** Hàng chép link trong menu chia sẻ — nút 44px có nhãn đầy đủ. */
/**
 * Panel chia sẻ sổ — DATA-04(ii) / UI-11 (re-grade r2): KHÔNG còn chép link
 * một chạm. Người dùng phải qua 2 lớp ngay tại điểm chia sẻ:
 *   Lớp 1 — xem trước (preview): thấy đúng link sẽ gửi + sổ nào sẽ mở,
 *           kèm cảnh báo hệ quả nguyên văn (ai có link cũng mở được toàn
 *           bộ sổ, không mật khẩu thêm).
 *   Lớp 2 — xác nhận "Tôi hiểu, hiện nút chép link" mới hiện nút chép.
 * Kèm lối thu hồi: đổi mã mời (mã cũ + mọi link đã gửi chết ngay) với xác
 * nhận hệ quả riêng — đây là đường xử lý khi link đã lỡ phát tán.
 */
export function SharePanel({
  api,
  book,
  onClose,
  onRotated,
  onToast,
  onError,
}: {
  api: SodamApi;
  book: SodamBook;
  onClose: () => void;
  onRotated: (book: SodamBook) => void;
  onToast: PushToast;
  onError: (m: string | null) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [rotateStage, setRotateStage] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [justRotated, setJustRotated] = useState(false);
  const link = `${window.location.origin}/?code=${encodeURIComponent(book.inviteCode)}`;

  const doRotate = async () => {
    setRotateStage('busy');
    try {
      const next = await api.rotateInviteCode(book.id);
      onRotated(next);
      setRevealed(false);
      setRotateStage('idle');
      setJustRotated(true);
      onToast('Đã đổi mã mời — link cũ không còn mở được sổ này.');
    } catch (e) {
      setRotateStage('idle');
      onError(friendlyError(e, 'Chưa đổi được mã mời'));
    }
  };

  return (
    <span className="block">
      <span className="block text-sm font-medium text-ink">Chia sẻ sổ «{book.name}»</span>

      {justRotated ? (
        <span
          className="mt-2 block rounded-[10px] bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700"
          role="status"
        >
          Đã đổi mã mời. Mã mới{' '}
          <span className="font-mono font-semibold">{formatInviteCode(book.inviteCode)}</span> — chỉ
          thiết bị này biết; muốn chia sẻ tiếp phải qua cảnh báo dưới đây một lần nữa.
        </span>
      ) : null}

      {/* Lớp xem trước: đúng thứ người nhận sẽ bấm vào. */}
      <span className="mt-2 block rounded-[10px] border border-line bg-paper px-3 py-2.5">
        <span className="block text-xs text-muted">Link sẽ gửi đi</span>
        <span className="mt-0.5 block font-mono text-xs break-all text-ink">{link}</span>
        <span className="mt-1.5 block text-xs text-muted">
          Mã mời{' '}
          <span className="font-mono font-medium text-ink">
            {formatInviteCode(book.inviteCode)}
          </span>
        </span>
      </span>

      <span className="mt-2 block text-sm leading-relaxed text-muted">
        Ai có link này cũng mở được <strong className="font-semibold text-ink">toàn bộ sổ</strong> —
        xem hết mọi khoản, ghi thêm và sửa được, không cần mật khẩu nào nữa. Chỉ gửi cho người trong
        nhà, và đừng đăng link lên nơi công khai.
      </span>

      {!revealed ? (
        <span className="mt-3 flex gap-2">
          <Btn variant="secondary" onClick={onClose}>
            Quay lại
          </Btn>
          <Btn onClick={() => setRevealed(true)}>Tôi hiểu, hiện nút chép link</Btn>
        </span>
      ) : (
        <span className="mt-3 block">
          <InviteShareRow inviteCode={book.inviteCode} />
        </span>
      )}

      {/* Thu hồi: đổi mã mời. */}
      <span className="mt-3 block border-t border-line pt-3">
        {rotateStage === 'confirm' || rotateStage === 'busy' ? (
          <span className="block">
            <span className="block text-sm leading-relaxed text-muted">
              Đổi mã xong,{' '}
              <strong className="font-semibold text-ink">
                mã cũ và mọi link đã gửi sẽ không mở được sổ nữa
              </strong>
              . Thiết bị khác đang giữ mã cũ phải nhập mã mới; thiết bị này tự chuyển sang mã mới.
            </span>
            <span className="mt-2 flex gap-2">
              <Btn
                variant="secondary"
                disabled={rotateStage === 'busy'}
                onClick={() => setRotateStage('idle')}
              >
                Huỷ
              </Btn>
              <Btn disabled={rotateStage === 'busy'} onClick={() => void doRotate()}>
                {rotateStage === 'busy' ? 'Đang đổi…' : 'Đổi mã ngay'}
              </Btn>
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setRotateStage('confirm')}
            className="inline-flex min-h-11 items-center rounded-[10px] px-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Mã đã bị lộ? Đổi mã mời
          </button>
        )}
      </span>
    </span>
  );
}

function InviteShareRow({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  return (
    <span className="block">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-indigo-700 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        onClick={() => {
          const link = `${window.location.origin}/?code=${encodeURIComponent(inviteCode)}`;
          void (async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2500);
            } catch {
              setFallback(link);
            }
          })();
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : null}
        {copied ? 'Đã chép link' : 'Chép link chia sẻ'}
      </button>
      {fallback ? (
        <span className="mt-2 block font-mono text-xs break-all text-ink">{fallback}</span>
      ) : null}
    </span>
  );
}
