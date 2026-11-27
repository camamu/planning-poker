import type { JSX } from 'react';
import { Holly, Snowflake } from '../Seasonal/Seasonal.js';

export type CardState = 'available' | 'selected' | 'face-down' | 'revealed';

export interface CardProps {
  /** Valor de la carta (p.ej. "5", "?", "☕"). En 'face-down' no se muestra. */
  readonly label: string;
  readonly state: CardState;
  /**
   * 'lg' = mano (74×104), 'sm' = asiento en la mesa (50×70); en el móvil, 'md' = mano (56×80) y
   * 'xs' = asiento (38×52). Por defecto según `state`.
   */
  readonly size?: CardSize;
  readonly special?: boolean;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, string> = {
  xs: 'w-[38px] h-[52px]',
  sm: 'w-[50px] h-[70px]',
  md: 'w-[56px] h-[80px]',
  lg: 'w-[74px] h-[104px]',
};

/** Tamaño del valor y cuánto sube la carta elegida de la mano. */
const FACE: Record<CardSize, { readonly text: string; readonly lift: string }> = {
  xs: { text: 'text-[18px]', lift: '-translate-y-2' },
  sm: { text: 'text-2xl', lift: '-translate-y-2' },
  md: { text: 'text-[19px]', lift: '-translate-y-2' },
  lg: { text: 'text-[26px]', lift: '-translate-y-[14px]' },
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
        FACE[size].text,
        'relative inline-flex flex-none items-center justify-center rounded-[10px] border-[1.5px] font-semibold transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0.85,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45',
        props.special ? 'border-dashed' : '',
        selected
          ? `border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-accent)] shadow-[0_10px_26px_rgba(145,132,217,.32)] ${FACE[size].lift}`
          : 'border-[var(--pp-line)] bg-[var(--color-surface)] text-[var(--color-text)] hover:-translate-y-3 hover:rotate-[-2deg]',
      ].join(' ')}
    >
      <span
        className="pp-winter-only"
        style={{ position: 'absolute', top: 5, left: 5, lineHeight: 0, color: 'var(--pp-muted)' }}
      >
        <Snowflake size={10} />
      </span>
      {props.label}
    </button>
  );
}

/** Copo del reverso y acebo de la cara en temporada de invierno (ADR 0031). */
const WINTER_ART: Record<CardSize, { readonly flake: number; readonly holly: number }> = {
  xs: { flake: 32, holly: 10 },
  sm: { flake: 44, holly: 13 },
  md: { flake: 50, holly: 15 },
  lg: { flake: 64, holly: 18 },
};

function FlippableCard(props: CardProps & { size: CardSize }): JSX.Element {
  const revealed = props.state === 'revealed';
  const art = WINTER_ART[props.size];
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
          <span
            className="pp-winter-only"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              lineHeight: 0,
              color: 'var(--color-accent-300)',
              opacity: 0.24,
            }}
          >
            <Snowflake size={art.flake} />
          </span>
          <div
            className={`relative flex items-center justify-center rounded-full border-[1.5px] font-bold ${
              props.size === 'xs' ? 'h-[18px] w-[18px] text-[10px]' : 'h-6 w-6 text-xs'
            }`}
            style={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-300)' }}
          >
            ✓
          </div>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-[7px] border font-semibold ${FACE[props.size].text}`}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderColor: 'var(--color-accent)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxShadow: '0 0 18px rgba(145,132,217,.28)',
          }}
        >
          {revealed ? (
            <span
              className="pp-winter-only"
              style={{ position: 'absolute', top: 4, right: 4, lineHeight: 0 }}
            >
              <Holly size={art.holly} />
            </span>
          ) : null}
          {revealed ? props.label : ''}
        </div>
      </div>
    </div>
  );
}
