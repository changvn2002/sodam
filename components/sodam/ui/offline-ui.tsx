'use client';

import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Offline UI kit for lane UI to mount (indigo redesign system):
 *  - <OfflineBanner online={online} /> — sticky strip while offline.
 *  - <OutboxChip count={pendingCount} failed={flushFailed} onRetry={...} />
 *    — queued-entry indicator fed by useSodamOffline.
 * Status is never conveyed by icon alone: both pieces carry explicit text.
 */

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium text-white"
      style={{ backgroundColor: '#1F2328' }}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Đang offline — kiểm tra kết nối mạng.</span>
    </div>
  );
}

export function OutboxChip({
  count,
  failed = false,
  onRetry,
}: {
  count: number;
  failed?: boolean;
  onRetry?: () => void;
}) {
  if (count <= 0) return null;

  const label = failed
    ? `${count} khoản chưa gửi được — chạm để thử lại`
    : `${count} khoản đang chờ gửi`;

  const className = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-medium',
    failed ? 'min-h-11 cursor-pointer' : 'min-h-9',
  );
  const style = {
    backgroundColor: '#F0F1F8',
    borderColor: '#7E85AB',
    color: failed ? '#D1242F' : '#1F2328',
  } as const;

  if (failed) {
    return (
      <button type="button" onClick={onRetry} className={className} style={style}>
        {label}
      </button>
    );
  }

  return (
    <span role="status" className={className} style={style}>
      {label}
    </span>
  );
}
