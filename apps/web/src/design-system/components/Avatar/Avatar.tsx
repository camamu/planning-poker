import type { JSX } from 'react';

const HUES = [289, 250, 200, 330, 30, 150, 100, 350, 60];

/** Deriva un hue estable de `HUES` a partir de un id — no sabe qué es un participante. */
export function hueForSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = HUES[Math.abs(hash) % HUES.length];
  return hue ?? 0;
}

export interface AvatarProps {
  /** Id estable usado para derivar el color si no se pasa `hue` explícito. */
  readonly seed: string;
  readonly hue?: number;
  readonly size?: number;
  /** 'monster' = cara con ojos y boca (mesa); 'initials' = solo iniciales (barra superior). */
  readonly variant?: 'monster' | 'initials';
  readonly initials?: string;
  readonly animated?: boolean;
  readonly opacity?: number;
}

export function Avatar(props: AvatarProps): JSX.Element {
  const hue = props.hue ?? hueForSeed(props.seed);
  const size = props.size ?? 24;
  const variant = props.variant ?? 'monster';

  const style = {
    width: size,
    height: size,
    background: `oklch(0.73 0.125 ${hue.toString()})`,
    opacity: props.opacity,
    animation: props.animated ? 'ppFloat 4s ease-in-out infinite' : undefined,
  };

  if (variant === 'initials') {
    return (
      <div
        className="flex flex-none items-center justify-center rounded-[10px] text-xs font-bold"
        style={{ ...style, color: '#1b1d2c' }}
      >
        {props.initials}
      </div>
    );
  }

  return (
    <div className="relative flex-none rounded-[8px]" style={style}>
      <span
        className="absolute rounded-full"
        style={{
          top: size * 0.29,
          left: size * 0.21,
          width: size * 0.21,
          height: size * 0.21,
          background: '#1b1d2c',
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          top: size * 0.29,
          right: size * 0.21,
          width: size * 0.21,
          height: size * 0.21,
          background: '#1b1d2c',
        }}
      />
      <span
        className="absolute rounded-sm"
        style={{
          bottom: size * 0.21,
          left: '50%',
          marginLeft: -size * 0.17,
          width: size * 0.33,
          height: size * 0.125,
          background: 'rgba(27,29,44,.55)',
        }}
      />
    </div>
  );
}
