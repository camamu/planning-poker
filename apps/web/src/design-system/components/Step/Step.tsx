import type { JSX } from 'react';

export interface StepProps {
  readonly number: number;
  readonly title: string;
  readonly description: string;
}

/** Un paso de una secuencia: el número solo tiene sentido si el orden importa. */
export function Step({ number, title, description }: StepProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full font-mono text-xs font-semibold"
        style={{ border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
      >
        {number}
      </span>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg" style={{ lineHeight: 1.4, letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        <p className="m-0 text-[13px]" style={{ color: 'var(--pp-muted)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
