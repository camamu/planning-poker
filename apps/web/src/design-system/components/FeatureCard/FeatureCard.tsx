import type { JSX } from 'react';
import { Icon } from '../Icon/Icon.js';
import type { IconName } from '../Icon/Icon.js';

export interface FeatureCardProps {
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps): JSX.Element {
  return (
    <div
      className="flex w-full items-start gap-2.5 rounded-[10px] p-3"
      style={{ background: 'var(--color-surface)', boxShadow: '0 0 0 1px var(--pp-line)' }}
    >
      <span className="mt-px" style={{ color: 'var(--color-accent)' }}>
        <Icon name={icon} />
      </span>
      <div className="flex min-w-0 flex-col">
        <h4 className="text-[13.5px]" style={{ lineHeight: 1.35, letterSpacing: 0 }}>
          {title}
        </h4>
        <p className="m-0 text-[12.5px] leading-snug" style={{ color: 'var(--pp-muted)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
