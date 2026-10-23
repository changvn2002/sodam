'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './avatar';

/**
 * Một dòng sổ cái: avatar + tên + meta trái, số tiền Mono căn phải.
 * Số tiền không bọc pill — cột số phải thẳng hàng để mắt quét dọc là cộng được.
 */
export function LedgerRow({
  name,
  personId,
  amountLabel,
  meta,
  trailing,
  onClick,
}: {
  name: string;
  /** Id người (khi có) — truyền làm seed cho avatar để màu/hình ổn định. */
  personId?: string;
  amountLabel: string;
  meta?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    'flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
    onClick &&
      'hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset',
  );

  const body = (
    <>
      <PersonAvatar name={name} seed={personId} size="md" className="relative z-[1]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{name}</span>
        {meta ? <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span> : null}
      </span>
      <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-ink">
        {amountLabel}
      </span>
      {trailing}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}
