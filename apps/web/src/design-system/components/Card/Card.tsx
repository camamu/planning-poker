import type { JSX } from 'react';

export type CardState = 'available' | 'selected' | 'face-down' | 'revealed';

export interface CardProps {
  /** Valor de la carta (p.ej. "5", "?", "☕"). En 'face-down' no se muestra. */
  readonly label: string;
  readonly state: CardState;
  /** 'lg' = mano (74×104), 'sm' = asiento en la mesa (50×70). Por defecto según `state`. */
  readonly size?: 'sm' | 'lg';
  readonly special?: boolean;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

const SIZES: Record<'sm' | 'lg', string> = {
  sm: 'w-[50px] h-[70px]',
  lg: 'w-[74px] h-[104px]',
};

/**
 * La carta de estimación — el componente más importante del producto (docs/04-brief-diseno.md §3).
 * No sabe qué es una partida ni qué es votar: solo pinta uno de sus cuatro estados visuales.
 */
export function Card(props: CardProps): JSX.Element {
  const size =
    props.size ?? (props.state === 'available' || props.state === 'selected' ? 'lg' : 'sm');

  if (props.state === 'face-down' || props.state === 'revealed') {
    return <FlippableCard {...props} size={size} />;
  }

  const selected = props.state === 'selected';
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      aria-pressed={selected}
      className={[
        SIZES[size],
        'inline-flex items-center justify-center rounded-[10px] border-[1.5px] font-semibold text-[26px] transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0.85,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45',
        props.special ? 'border-dashed' : '',
        selected
          ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-accent)] -translate-y-[14px] shadow-[0_10px_26px_rgba(145,132,217,.32)]'
          : 'border-[var(--pp-line)] bg-[var(--color-surface)] text-[var(--color-text)] hover:-translate-y-3 hover:rotate-[-2deg]',
      ].join(' ')}
    >
      {props.label}
    </button>
  );
}

function FlippableCard(props: CardProps & { size: 'sm' | 'lg' }): JSX.Element {
  const revealed = props.state === 'revealed';
  return (
    <div className={SIZES[props.size]} style={{ perspective: '700px' }}>
      <div
        className="relative h-full w-full rounded-[7px] transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.85,0.3,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[7px] border"
          style={{
            backfaceVisibility: 'hidden',
            borderColor: 'var(--color-accent-600)',
            background: 'var(--color-accent-800)',
          }}
        >
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] text-xs font-bold"
            style={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-300)' }}
          >
            ✓
          </div>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[7px] border font-semibold text-2xl"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderColor: 'var(--color-accent)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxShadow: '0 0 18px rgba(145,132,217,.28)',
          }}
        >
          {revealed ? props.label : ''}
        </div>
      </div>
    </div>
  );
}
