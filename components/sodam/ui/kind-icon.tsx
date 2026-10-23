import type { SodamEventKind } from '../api/types';
import { groupOfKind, type LexiconGroup } from '../lib/lexicon';

/**
 * Icon nét vẽ tay theo nhóm giọng (V-5) — SVG stroke currentColor,
 * không dùng icon hộp quà (Gift) cho bất kỳ nhóm nào.
 */
export function GroupIcon({ group, className }: { group: LexiconGroup; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {group === 'celebratory' && (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <polyline points="3,7 12,13 21,7" />
        </>
      )}
      {group === 'solemn' && (
        <>
          <circle cx="12" cy="12" r="7" />
          <line x1="20.5" y1="12" x2="22.2" y2="12" />
          <line x1="18" y1="18" x2="19.2" y2="19.2" />
          <line x1="12" y1="20.5" x2="12" y2="22.2" />
          <line x1="6" y1="18" x2="4.8" y2="19.2" />
          <line x1="3.5" y1="12" x2="1.8" y2="12" />
          <line x1="6" y1="6" x2="4.8" y2="4.8" />
          <line x1="12" y1="3.5" x2="12" y2="1.8" />
          <line x1="18" y1="6" x2="19.2" y2="4.8" />
        </>
      )}
      {group === 'memorial' && (
        <>
          <path d="M9 8 C 8 6, 10 5, 9 3" />
          <path d="M15 8 C 14 6, 16 5, 15 3" />
          <line x1="8" y1="10" x2="8" y2="17" />
          <line x1="12" y1="10" x2="12" y2="17" />
          <line x1="16" y1="10" x2="16" y2="17" />
          <line x1="5" y1="19" x2="19" y2="19" />
        </>
      )}
      {group === 'longevity' && (
        <>
          <path d="M5 19 C 8 14, 12 10, 18 6" />
          <circle cx="13" cy="10" r="2" />
          <circle cx="17" cy="8" r="2" />
          <path d="M9 14 C 7 12, 6.5 9.5, 7 7 C 9.5 7.5, 10.5 10, 9 14" />
        </>
      )}
      {group === 'neutral' && (
        <>
          <rect x="6" y="3" width="13" height="18" rx="2" />
          <line x1="9.5" y1="3" x2="9.5" y2="21" />
          <line x1="12.5" y1="9" x2="16.5" y2="9" />
          <line x1="12.5" y1="13" x2="16.5" y2="13" />
        </>
      )}
    </svg>
  );
}

export function KindIcon({
  kind,
  className,
}: {
  kind: SodamEventKind | string | null | undefined;
  className?: string;
}) {
  return <GroupIcon group={groupOfKind(kind)} className={className} />;
}
