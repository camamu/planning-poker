import { useState } from 'react';
import type { JSX, ReactNode } from 'react';

export interface TooltipProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        setVisible(true);
      }}
      onMouseLeave={() => {
        setVisible(false);
      }}
      onFocus={() => {
        setVisible(true);
      }}
      onBlur={() => {
        setVisible(false);
      }}
    >
      {children}
      {visible ? (
        <span className="pp-tooltip" role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
