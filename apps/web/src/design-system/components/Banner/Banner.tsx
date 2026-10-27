import type { JSX } from 'react';
import { Button } from '../Button/Button.js';

export type BannerVariant = 'info' | 'error';

export interface BannerAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface BannerProps {
  readonly message: string;
  readonly variant?: BannerVariant;
  readonly action?: BannerAction;
}

export function Banner({ message, variant = 'info', action }: BannerProps): JSX.Element {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`pp-banner pp-banner-${variant}`}
    >
      <span>{message}</span>
      {action ? (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
