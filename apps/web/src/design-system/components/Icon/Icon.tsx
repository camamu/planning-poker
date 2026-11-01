import type { JSX } from 'react';

/** Trazos a 24×24 con `currentColor`: el icono hereda el color del texto que lo rodea. */
const ICONS = {
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </>
  ),
  flip: (
    <>
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <rect x="13" y="5" width="8" height="14" rx="1.5" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </>
  ),
  play: <path d="M7 4l13 8-13 8z" />,
  repeat: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />,
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  bars: <path d="M5 20V11M11 20V5M17 20v-7M3 20h18" />,
  percent: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  ),
  feather: <path d="M20 4C11 4 6 9 6 18M4 20l2-2M6 18c6 0 11-4 12-10M9 15h6" />,
  compare: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  doc: <path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6" />,
  download: <path d="M4 17v3h16v-3M12 4v12M7 11l5 5 5-5" />,
  glasses: (
    <>
      <circle cx="6" cy="15" r="3.5" />
      <circle cx="18" cy="15" r="3.5" />
      <path d="M9.5 15h5M2.5 15L5 6M21.5 15L19 6" />
    </>
  ),
  hourglass: (
    <path d="M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  hat: <path d="M7 17V6h10v11M3 17h18M7 13h10" />,
  deal: <path d="M4 7l8-3 2 5M9 8h10v13H9z" />,
  swap: <path d="M4 8h14l-4-4M20 16H6l4 4" />,
  presence: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </>
  ),
  crown: <path d="M3 19h18M4 16L3 7l5 4 4-6 4 6 5-4-1 9z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  import: <path d="M3 12h12M11 8l4 4-4 4M15 4h5v16h-5" />,
  palette: (
    <>
      <rect x="3" y="4" width="8" height="12" rx="1.5" />
      <rect x="13" y="8" width="8" height="12" rx="1.5" />
    </>
  ),
  link: (
    <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />
  ),
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />,
  webhook: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <circle cx="12" cy="6" r="3" />
      <path d="M10.5 8.5l-3 6M13.5 8.5l3 6M9 17h6" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h12l-2.5 4L17 12H5" />,
  stack: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  rocket: (
    <path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2M9 15l-3-3c1-4 4.5-9 12-9 0 7.5-5 11-9 12zM15 9h.01" />
  ),
  leaf: <path d="M5 21c0-9 6-15 15-16-1 9-7 15-15 16zM5 21l7-7" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  box: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
  anchor: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M5 13a7 7 0 0 0 14 0M8 11h8" />
    </>
  ),
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof ICONS;

/**
 * Iconos sin significado propio para distinguir elementos a simple vista (accesos recordados):
 * cada uno recibe siempre el mismo por su id, como el color de `hueForSeed`.
 */
const SEED_ICONS: ReadonlyArray<IconName> = [
  'server',
  'wallet',
  'flag',
  'stack',
  'compass',
  'rocket',
  'leaf',
  'target',
  'box',
  'anchor',
];

export function iconForSeed(seed: string): IconName {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return SEED_ICONS[Math.abs(hash) % SEED_ICONS.length] ?? 'stack';
}

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({ name, size = 18 }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      {ICONS[name]}
    </svg>
  );
}
