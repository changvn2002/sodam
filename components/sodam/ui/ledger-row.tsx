'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './avatar';

/** Enterprise ledger row — timeline + DiceBear avatar + amount pill. */
export function LedgerRow({
  name,
  amountLabel,
  meta,
  trailing,
  onClick,
}: {
  name: string;
  amountLabel: string;
  meta?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    'group relative flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 text-left transition-colors sm:flex-nowrap',
    onClick &&
      'hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
  );

  const body = (
    <>
      <span
        className="absolute top-0 bottom-0 left-[1.65rem] hidden w-px bg-line sm:block group-first:top-1/2 group-last:bottom-1/2"
        aria-hidden
      />
      <PersonAvatar name={name} size="md" className="relative z-[1]" />
      <span className="min-w-0 flex-1 basis-[min(100%,12rem)]">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        {meta ? <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span> : null}
      </span>
      <span className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-ink">
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
