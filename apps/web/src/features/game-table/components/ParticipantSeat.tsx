import type { HatIdView } from '@pp/contracts';
import type { JSX } from 'react';
import { Avatar, Card } from '../../../design-system/index.js';
import type { SeatPosition } from '../seatLayout.js';

export type SeatBadge = 'feather' | 'cape';

export interface ParticipantSeatProps {
  readonly participantId: string;
  readonly displayName: string;
  readonly seat: SeatPosition;
  readonly isDealer: boolean;
  readonly isViewer: boolean;
  /** Conectado ahora mismo; si no, el asiento se atenúa (ADR 0015). */
  readonly online: boolean;
  readonly hat?: HatIdView | null | undefined;
  readonly isFacilitator?: boolean | undefined;
  /** Solo lo recibe el facilitador, y nunca para su propio asiento. */
  readonly onRemove?: (() => void) | undefined;
  /** Igual que `onRemove`: solo el facilitador puede ceder el rol a otro asiento. */
  readonly onMakeFacilitator?: (() => void) | undefined;
  /** null = no ha votado (hueco vacío). */
  readonly card: { readonly hasVoted: boolean; readonly value: string | null } | null;
  readonly badge?: SeatBadge | undefined;
  readonly onClick?: (() => void) | undefined;
  /** Mesa compacta del móvil (docs/06-handoff-diseno.md §8): carta 38×52 y nombre a 10 px. */
  readonly compact?: boolean | undefined;
}

/** Medidas del asiento en la mesa de escritorio y en la compacta del móvil. */
const LOOK = {
  regular: {
    box: 'w-[112px] gap-[7px] rounded-[14px] py-2',
    emptyCard: 'h-[70px] w-[50px] rounded-[7px]',
    nameRow: 'max-w-[108px] gap-1.5 pt-1.5',
    avatar: 24,
    name: 'text-xs',
    crown: 'text-[11px]',
    dealer: 'h-[17px] w-[17px] text-[9px]',
    badge: 'max-w-[104px] px-2 py-[3px] text-[10px]',
    cape: 'h-[74px] w-16',
  },
  compact: {
    box: 'w-[80px] gap-1 rounded-[12px] py-1',
    emptyCard: 'h-[52px] w-[38px] rounded-[6px]',
    nameRow: 'max-w-[78px] gap-1 pt-1',
    avatar: 18,
    name: 'text-[10px]',
    crown: 'text-[10px]',
    dealer: 'h-[14px] w-[14px] text-[8px]',
    badge: 'max-w-[78px] px-1.5 py-[2px] text-[9px]',
    cape: 'h-14 w-12',
  },
} as const;

export function ParticipantSeat(props: ParticipantSeatProps): JSX.Element {
  const voted = props.card?.hasVoted ?? false;
  const revealed = voted && props.card?.value !== null;
  const look = props.compact ? LOOK.compact : LOOK.regular;

  return (
    <div
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${look.box}`}
      style={{
        left: props.seat.left,
        top: props.seat.top,
        // En la rejilla del móvil la caja de cada asiento se tocaría con la de al lado.
        background: props.compact ? undefined : 'rgba(22,24,38,.42)',
        boxShadow: props.compact ? undefined : 'inset 0 0 0 1px rgba(145,132,217,.14)',
        cursor: props.onClick ? 'pointer' : undefined,
        opacity: props.online ? 1 : 0.45,
      }}
      title={props.online ? undefined : `${props.displayName} está desconectado`}
      // En invierno se posa nieve encima (Snowfall mide los elementos con este atributo).
      data-snow-cap=""
      onClick={props.onClick}
      role={props.onClick ? 'button' : undefined}
    >
      {props.onMakeFacilitator ? (
        <button
          type="button"
          // A la izquierda y por encima: junto al ✕ quedaba debajo de la carta en cuanto votaba.
          className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
          style={{ background: 'rgba(22,24,38,.85)', color: 'var(--color-neutral-100)' }}
          aria-label={`Hacer facilitador a ${props.displayName}`}
          title={`Hacer facilitador a ${props.displayName}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onMakeFacilitator?.();
          }}
        >
          🔑
        </button>
      ) : null}
      {props.onRemove ? (
        <button
          type="button"
          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
          style={{ background: 'rgba(22,24,38,.85)', color: 'var(--color-neutral-100)' }}
          aria-label={`Quitar a ${props.displayName}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onRemove?.();
          }}
        >
          ✕
        </button>
      ) : null}
      {props.badge === 'feather' ? <FeatherOverlay /> : null}
      {props.badge === 'cape' ? <CapeOverlay size={look.cape} /> : null}

      {voted ? (
        <Card
          label={props.card?.value ?? ''}
          state={revealed ? 'revealed' : 'face-down'}
          size={props.compact ? 'xs' : 'sm'}
        />
      ) : (
        <div
          className={`border border-dashed ${look.emptyCard}`}
          style={{ borderColor: 'var(--pp-line)' }}
        />
      )}

      {/* pt reserva el hueco del sombrero para que no pise la carta de encima. */}
      <div className={`flex items-center ${look.nameRow}`}>
        <Avatar seed={props.participantId} size={look.avatar} animated hat={props.hat} />
        <span className={`truncate ${look.name}`} style={{ color: 'var(--color-neutral-100)' }}>
          {props.isViewer ? 'Tú' : props.displayName}
        </span>
        {props.isFacilitator ? (
          <span
            className={`flex-none ${look.crown}`}
            role="img"
            aria-label="Facilitador"
            title="Facilitador"
          >
            👑
          </span>
        ) : null}
        {props.isDealer ? (
          <span
            className={`flex flex-none items-center justify-center rounded-full font-bold ${look.dealer}`}
            style={{ background: 'var(--color-neutral-200)', color: '#1b1d2c' }}
          >
            D
          </span>
        ) : null}
      </div>

      {props.badge === 'feather' ? (
        <span
          className={`truncate rounded-full border ${look.badge}`}
          style={{ borderColor: 'var(--color-neutral-400)', color: 'var(--color-neutral-100)' }}
        >
          🐔 Cobarde
        </span>
      ) : null}
      {props.badge === 'cape' ? (
        <span
          className={`truncate rounded-full border ${look.badge}`}
          style={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-200)' }}
        >
          🦸 Valiente
        </span>
      ) : null}
    </div>
  );
}

function FeatherOverlay(): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-4 h-24" aria-hidden="true">
      <span
        className="absolute h-[15px] w-[9px] rounded-[60%_60%_50%_50%/80%_80%_35%_35%]"
        style={{
          left: '18%',
          top: 0,
          background: 'var(--color-neutral-200)',
          animation: 'ppPluma 2.6s ease-in infinite',
        }}
      />
      <span
        className="absolute h-[13px] w-2 rounded-[60%_60%_50%_50%/80%_80%_35%_35%]"
        style={{
          left: '46%',
          top: 6,
          background: 'var(--color-neutral-300)',
          animation: 'ppPluma 3.1s ease-in .5s infinite',
        }}
      />
    </div>
  );
}

function CapeOverlay({ size }: { readonly size: string }): JSX.Element {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-1.5 opacity-85 ${size}`}
      style={{
        background: 'linear-gradient(180deg, var(--color-accent-600), var(--color-accent-800))',
        clipPath: 'polygon(50% 0,100% 8%,86% 100%,50% 84%,14% 100%,0 8%)',
        transformOrigin: '50% 8%',
        animation: 'ppCapa 2.4s ease-in-out infinite',
      }}
      aria-hidden="true"
    />
  );
}
