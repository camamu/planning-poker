import type { JSX } from 'react';

export interface DistributionBarProps {
  readonly label: string;
  readonly count: number;
  readonly total: number;
  readonly isMostVoted: boolean;
}

export function DistributionBar({
  label,
  count,
  total,
  isMostVoted,
}: DistributionBarProps): JSX.Element {
  const width = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-7 text-sm font-semibold"
        style={{ color: isMostVoted ? 'var(--color-accent)' : 'var(--color-text)' }}
      >
        {label}
      </span>
      <div
        className="h-[22px] flex-1 overflow-hidden rounded-md"
        style={{ background: 'var(--pp-line)' }}
      >
        <div
          className="h-full rounded-md"
          style={{
            width: `${width.toString()}%`,
            background: isMostVoted ? 'var(--color-accent)' : 'var(--color-accent-700)',
          }}
        />
      </div>
      <span className="w-4 text-right text-xs" style={{ color: 'var(--pp-muted)' }}>
        {count}
      </span>
    </div>
  );
}
