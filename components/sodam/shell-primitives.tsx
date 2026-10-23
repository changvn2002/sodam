'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
            ) : null}
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-ink">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-sm font-medium text-lacquer">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input(props: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
        props.className,
      )}
    />
  );
}

export function Select(props: React.ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        'min-h-12 w-full rounded-[10px] border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
        props.className,
      )}
    />
  );
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-indigo-700 text-white hover:bg-indigo-600',
        variant === 'secondary' && 'border border-line-strong bg-card text-ink hover:bg-indigo-50',
        variant === 'ghost' && 'text-indigo-700 hover:bg-indigo-50',
        variant === 'danger' && 'bg-lacquer text-white hover:bg-lacquer/90',
        className,
      )}
    >
      {children}
    </button>
  );
}
