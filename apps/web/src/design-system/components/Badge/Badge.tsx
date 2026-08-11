import type { JSX, ReactNode } from 'react';

export type BadgeVariant = 'accent' | 'neutral' | 'outline';

export interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral' }: BadgeProps): JSX.Element {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}
