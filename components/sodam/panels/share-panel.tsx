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
  // TC5-3 (Panel #05, MINOR bảo mật): TRƯỚC cổng «Tôi hiểu…» không node
  // visible nào được chứa ≥8 ký tự liên tiếp của mã — chỉ dạng che, tối đa
  // 4 ký tự đuôi; chọn-bôi cũng không thu được mã vì DOM chỉ chứa bản che.
  // Sau cổng: mã đầy đủ hiện theo NHÓM 4 (F6) + nút chép mang link trọn.
  const last4 = book.inviteCode.replace(/\s/g, '').slice(-4);
  const maskedCode = `•••• •••• •••• ${last4}`;

  // F6: mã hiển thị theo NHÓM 4 ký tự, mỗi nhóm là một khối không vỡ —
  // link không còn ngắt dòng giữa mã; người đọc/ghi lại theo nhóm được.
  const codeGroups = (revealed ? formatInviteCode(book.inviteCode) : maskedCode).split(' ');

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
        <span className="mt-2 block border-y border-line py-2.5 text-sm text-ink" role="status">
          Đã đổi mã mời. Mã mới <span className="font-mono font-semibold">{maskedCode}</span> — chỉ
          thiết bị này biết; muốn chia sẻ tiếp phải qua cảnh báo dưới đây một lần nữa.
        </span>
      ) : null}

      {/* F6: PHẲNG HOÁ — bỏ card lồng trong panel. Link/mã nằm trên một
          khối phẳng ngăn bằng kẻ trên/dưới như một dòng sổ.
          Lớp xem trước: TRƯỚC cổng chỉ là bản CHE của đúng link sẽ gửi
          (TC5-3); sau cổng mới hiện link + mã đầy đủ để đối chiếu khi chép.
          Mã luôn hiện NGUYÊN KHỐI theo nhóm 4, không vỡ giữa mã: phần
          gốc link nằm một dòng riêng, mã nằm dòng riêng theo nhóm. */}
      <span className="mt-3 block border-y border-line py-3">
        <span className="block text-xs font-medium text-muted">Link sẽ gửi đi</span>
        <span className="mt-1 block font-mono text-xs text-ink">
          {window.location.origin}/?code=
        </span>
        <span className="mt-1 flex flex-wrap gap-x-2.5 font-mono text-[15px] font-semibold text-ink">
          {codeGroups.map((g, i) => (
            <span key={i} className="whitespace-nowrap">
              {g}
            </span>
          ))}
        </span>
        <span className="mt-2 block text-xs text-muted">
          Mã mời — đọc theo từng nhóm 4 ký tự như trên.
        </span>
      </span>

      <span className="mt-2 block text-sm leading-relaxed text-muted">
        Ai có link này cũng mở được <strong className="font-semibold text-ink">toàn bộ sổ</strong> —
        xem hết mọi khoản, ghi thêm và sửa được, không cần mật khẩu nào nữa. Chỉ gửi cho người trong
        nhà, và đừng đăng link lên nơi công khai.
      </span>

      {!revealed ? (
        <span className="mt-3 flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={onClose} className="shrink-0 whitespace-nowrap">
            Quay lại
          </Btn>
          <Btn onClick={() => setRevealed(true)} className="whitespace-nowrap">
            Tôi hiểu, hiện nút chép link
          </Btn>
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
            className="inline-flex min-h-11 items-center rounded-[7px] border border-line-strong px-3 text-sm font-bold text-ink transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Mã đã bị lộ? Đổi mã mới
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
        className="inline-flex min-h-11 items-center gap-2 rounded-[7px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
