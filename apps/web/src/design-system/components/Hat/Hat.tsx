import type { HatIdView } from '@pp/contracts';
import type { JSX } from 'react';

/** Nombre visible de cada sombrero, en el orden en que los ofrece el selector. */
export const HAT_LABELS: Record<HatIdView, string> = {
  cowboy: 'Vaquero',
  wizard: 'Mago',
  propeller: 'Hélices',
  crown: 'Corona',
  'top-hat': 'Chistera',
  party: 'Fiesta',
  pirate: 'Pirata',
  viking: 'Vikingo',
  chef: 'Chef',
  santa: 'Papá Noel',
  beanie: 'Gorro de lana',
  reindeer: 'Reno',
  elf: 'Elfo',
};

export interface HatProps {
  readonly hat: HatIdView;
  /** Ancho en px; el alto sale de la proporción 40×28 del viewBox. */
  readonly width: number;
}

/**
 * Todos comparten viewBox 40×28 con el ala (o la base) apoyada en y≈24, para que `Avatar` los
 * coloque con el mismo solape sin conocer la forma de cada uno.
 */
export function Hat({ hat, width }: HatProps): JSX.Element {
  return (
    <svg
      width={width}
      height={(width * 28) / 40}
      viewBox="0 0 40 28"
      aria-hidden="true"
      style={{ overflow: 'visible', display: 'block' }}
    >
      {HAT_ART[hat]}
    </svg>
  );
}

const INK = '#1b1d2c';

const HAT_ART: Record<HatIdView, JSX.Element> = {
  cowboy: (
    <g>
      <path
        d="M12 21 C11 13 12.5 6.5 16 6 Q18 6 20 8.5 Q22 6 24 6 C27.5 6.5 29 13 28 21 Z"
        fill="#b07a3e"
      />
      <path d="M20 8.5 Q19 12 20 15 Q21 12 20 8.5Z" fill="#8a5a2b" />
      <path d="M12.2 17.5 L27.8 17.5 L27.9 20.5 L12.1 20.5 Z" fill="#4a2c14" />
      <path
        d="M1 17.5 Q3 24.5 20 24.5 Q37 24.5 39 17.5 Q35 21.5 20 21 Q5 21.5 1 17.5Z"
        fill="#8a5a2b"
      />
      <path d="M17.5 18 L19 19 L17.5 20 Z" fill="#e8c66a" />
    </g>
  ),
  wizard: (
    <g>
      <path d="M10 23 Q16 14 22 3 Q24.5 -0.5 25.5 2.5 Q26.5 13 30 23 Z" fill="#5b3fb8" />
      <path d="M22 3 Q24.5 -0.5 25.5 2.5 L24.5 4 Q23.5 2.5 22 3Z" fill="#7a5fd6" />
      <ellipse cx="20" cy="23.5" rx="17" ry="3.5" fill="#46309a" />
      <path
        d="M17 13.5 l0.9 1.8 2 0.3 -1.45 1.4 0.35 2 -1.8 -0.95 -1.8 0.95 0.35 -2 -1.45 -1.4 2 -0.3Z"
        fill="#ffd54a"
      />
      <circle cx="24.5" cy="10" r="0.9" fill="#ffd54a" />
      <circle cx="23" cy="19" r="0.8" fill="#ffe89a" />
      <path
        d="M26 15.5 q0.4 1 1.3 1.3 q-0.9 0.3 -1.3 1.3 q-0.4 -1 -1.3 -1.3 q0.9 -0.3 1.3 -1.3Z"
        fill="#ffe89a"
      />
    </g>
  ),
  propeller: (
    <g>
      <path d="M8 24 Q8 12 20 12 L20 24 Z" fill="#e74c3c" />
      <path d="M20 12 Q32 12 32 24 L20 24 Z" fill="#3b82f6" />
      <path d="M14 13.6 Q17 12 20 12 L20 24 L14 24 Z" fill="#facc15" />
      <path d="M26 13.6 Q23 12 20 12 L20 24 L26 24 Z" fill="#22c55e" />
      <path d="M6 24 Q20 26.5 34 24 L34 25.5 Q20 28 6 25.5 Z" fill="#c0392b" />
      <rect x="19.2" y="7" width="1.6" height="5.5" rx="0.6" fill="#6b7280" />
      <g className="pp-hat-propeller">
        <path d="M20 7.5 Q13 4.5 9.5 6.8 Q13 9.5 20 7.5Z" fill="#ef4444" />
        <path d="M20 7.5 Q27 4.5 30.5 6.8 Q27 9.5 20 7.5Z" fill="#facc15" />
      </g>
      <circle cx="20" cy="7.5" r="1.4" fill="#374151" />
    </g>
  ),
  crown: (
    <g>
      <path d="M8 23 L6.5 9.5 L13.5 15.5 L20 5 L26.5 15.5 L33.5 9.5 L32 23 Z" fill="#f2c94c" />
      <path d="M20 5 L23 10.2 L20 13 L17 10.2Z" fill="#ffe08a" opacity="0.7" />
      <rect x="7.6" y="19.5" width="24.8" height="4.5" rx="1" fill="#d4a72c" />
      <circle cx="6.5" cy="9" r="1.5" fill="#ffe08a" />
      <circle cx="20" cy="4.5" r="1.6" fill="#ffe08a" />
      <circle cx="33.5" cy="9" r="1.5" fill="#ffe08a" />
      <circle cx="14" cy="21.75" r="1.3" fill="#3b82f6" />
      <ellipse cx="20" cy="21.75" rx="1.6" ry="1.9" fill="#e74c3c" />
      <circle cx="26" cy="21.75" r="1.3" fill="#22c55e" />
    </g>
  ),
  'top-hat': (
    <g>
      {/* Gris pizarra con filo claro, no negro: sobre el fieltro oscuro un negro puro desaparece. */}
      <path
        d="M11.5 22 L12 3.5 Q20 2 28 3.5 L28.5 22 Z"
        fill="#3a3d4d"
        stroke="#6b7088"
        strokeWidth="0.8"
      />
      <path d="M12 3.5 Q20 2 28 3.5 Q20 5.2 12 3.5Z" fill="#5a5e72" />
      <path d="M11.7 16.5 L28.3 16.5 L28.4 20.5 L11.6 20.5 Z" fill="#e74c3c" />
      <path d="M14 5.5 L14.3 15.5" stroke="#6b7088" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="20" cy="22.8" rx="15" ry="3" fill="#2a2c38" stroke="#6b7088" strokeWidth="0.8" />
    </g>
  ),
  party: (
    <g transform="rotate(-12 20 24)">
      <path d="M12.5 24 L20 3.5 L27.5 24 Z" fill="#ff6fa8" />
      <path d="M17.3 11 L22.7 11 L23.8 14 L16.2 14 Z" fill="#ffd54a" />
      <path d="M14.8 17.8 L25.2 17.8 L26.3 20.8 L13.7 20.8 Z" fill="#5eead4" />
      <path
        d="M12 24 Q20 26.5 28 24"
        stroke="#f9a8d4"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="20" cy="3" r="2.6" fill="#ffd54a" />
      <circle cx="19.2" cy="2.2" r="0.9" fill="#fff3b0" />
    </g>
  ),
  pirate: (
    <g>
      <path d="M2.5 19 Q8 5.5 20 8 Q32 5.5 37.5 19 Q30 23 20 22 Q10 23 2.5 19Z" fill="#1f2029" />
      <path
        d="M2.5 19 Q10 21.5 20 20.5 Q30 21.5 37.5 19"
        stroke="#e8c66a"
        strokeWidth="1.3"
        fill="none"
      />
      <path
        d="M15.5 17.5 L24.5 11.5 M15.5 11.5 L24.5 17.5"
        stroke="#f5f5f4"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12.6" r="3" fill="#f5f5f4" />
      <rect x="18.4" y="14.2" width="3.2" height="1.8" rx="0.5" fill="#f5f5f4" />
      <circle cx="18.9" cy="12.5" r="0.75" fill={INK} />
      <circle cx="21.1" cy="12.5" r="0.75" fill={INK} />
    </g>
  ),
  viking: (
    <g>
      <path d="M10.5 18 Q3 17 2.5 5 Q6 12.5 12.5 13.5 Z" fill="#f3e6c4" />
      <path d="M29.5 18 Q37 17 37.5 5 Q34 12.5 27.5 13.5 Z" fill="#f3e6c4" />
      <path d="M4 10 Q5.5 13.5 9 14.8" stroke="#d6c49a" strokeWidth="0.9" fill="none" />
      <path d="M36 10 Q34.5 13.5 31 14.8" stroke="#d6c49a" strokeWidth="0.9" fill="none" />
      <path d="M9 24 Q9 10 20 10 Q31 10 31 24 Z" fill="#9aa3b5" />
      <path
        d="M13 13.5 Q16 11.2 20 11"
        stroke="#c7cedb"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="8.5" y="20.5" width="23" height="3.8" rx="1" fill="#6b7385" />
      <rect x="18.8" y="10.2" width="2.4" height="11" fill="#6b7385" />
      <circle cx="12" cy="22.4" r="0.8" fill="#c7cedb" />
      <circle cx="16" cy="22.4" r="0.8" fill="#c7cedb" />
      <circle cx="24" cy="22.4" r="0.8" fill="#c7cedb" />
      <circle cx="28" cy="22.4" r="0.8" fill="#c7cedb" />
    </g>
  ),
  chef: (
    <g>
      <rect x="12" y="16" width="16" height="8.5" rx="1.2" fill="#f4f4f6" />
      <path d="M16 17 L16 24 M20 17 L20 24 M24 17 L24 24" stroke="#d9dae3" strokeWidth="1" />
      <circle cx="14" cy="12" r="5" fill="#ffffff" />
      <circle cx="26" cy="12" r="5" fill="#ffffff" />
      <circle cx="20" cy="8.5" r="6" fill="#ffffff" />
      <path d="M11 15.5 Q20 18 29 15.5 L29 17 Q20 19.2 11 17 Z" fill="#e4e5ec" />
      <path
        d="M16 6.5 Q18 4.5 21 4.6"
        stroke="#e4e5ec"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  ),
  // Gorros de temporada (ADR 0031): el selector solo los ofrece del 1 de diciembre al 6 de enero.
  santa: (
    <g>
      <path
        d="M8 20.5C9 11 15 5 23 5c6 0 10 4 12 10l-2.6 1.2c-1.4-3.4-3.8-5.4-6.2-5 2.8 3 4.8 6 5.8 9.3Z"
        fill="#d63a4a"
      />
      <path d="M26.2 11.2c2.8 3 4.8 6 5.8 9.3h-3.5c-.5-4-1.5-7-2.3-9.3Z" fill="#a82535" />
      <rect x="5.5" y="18.8" width="29" height="6" rx="3" fill="#f4f6ff" />
      <circle cx="34.6" cy="16.6" r="3.1" fill="#f4f6ff" />
    </g>
  ),
  beanie: (
    <g>
      <path d="M8.5 20Q8.5 8.5 20 8.5T31.5 20Z" fill="#3f7fd6" />
      <path d="M9.6 14.6Q20 11.6 30.4 14.6L31 17.4Q20 14.6 9 17.4Z" fill="#f4f6ff" />
      <rect x="7" y="18.5" width="26" height="6" rx="2" fill="#2c5fae" />
      <path
        d="M11 19.4v4.2M14.5 19.4v4.2M18 19.4v4.2M21.5 19.4v4.2M25 19.4v4.2M28.5 19.4v4.2"
        stroke="#4d8de0"
        strokeWidth="1.1"
      />
      <circle cx="20" cy="6.6" r="3.3" fill="#f4f6ff" />
    </g>
  ),
  reindeer: (
    <g>
      <path
        d="M7.5 24.5Q20 13 32.5 24.5"
        fill="none"
        stroke="#5a3a22"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g
        fill="none"
        stroke="#a8743f"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.5 18.8 10.5 8.5 9 4.5M10.5 8.5l3.1-3.3M11.6 12l-5-1.8M12.6 15.4l-4.2-.4" />
        <path d="M26.5 18.8 29.5 8.5 31 4.5M29.5 8.5l-3.1-3.3M28.4 12l5-1.8M27.4 15.4l4.2-.4" />
      </g>
    </g>
  ),
  elf: (
    <g>
      <path d="M10 20.5Q15.5 12 25.5 3.6 29 1 30 4.4q-1.8 7.6 0 16.1Z" fill="#2f9e63" />
      <path d="M25.5 3.6Q29 1 30 4.4L28.6 6q-1.1-1.6-3.1-2.4Z" fill="#43b878" />
      <rect x="8" y="18.6" width="24" height="5.6" rx="1.6" fill="#d63a4a" />
      <path
        d="m8.8 22.4 2.4-2.2 2.4 2.2 2.4-2.2 2.4 2.2 2.4-2.2 2.4 2.2 2.4-2.2 2.4 2.2 2.4-2.2"
        fill="none"
        stroke="#f4f6ff"
        strokeWidth="1"
      />
      <circle cx="29.6" cy="2.6" r="2.3" fill="#f2c94c" />
    </g>
  ),
};
