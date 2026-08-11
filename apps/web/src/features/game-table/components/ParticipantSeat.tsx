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
  /** null = no ha votado (hueco vacío). */
  readonly card: { readonly hasVoted: boolean; readonly value: string | null } | null;
  readonly badge?: SeatBadge | undefined;
  readonly onClick?: (() => void) | undefined;
}

export function ParticipantSeat(props: ParticipantSeatProps): JSX.Element {
  const voted = props.card?.hasVoted ?? false;
  const revealed = voted && props.card?.value !== null;

  return (
    <div
      className="absolute flex w-[112px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[7px] rounded-[14px] py-2"
      style={{
        left: props.seat.left,
        top: props.seat.top,
        background: 'rgba(22,24,38,.42)',
        boxShadow: 'inset 0 0 0 1px rgba(145,132,217,.14)',
        cursor: props.onClick ? 'pointer' : undefined,
      }}
      onClick={props.onClick}
      role={props.onClick ? 'button' : undefined}
    >
      {props.badge === 'feather' ? <FeatherOverlay /> : null}
      {props.badge === 'cape' ? <CapeOverlay /> : null}

      {voted ? (
        <Card
          label={props.card?.value ?? ''}
          state={revealed ? 'revealed' : 'face-down'}
          size="sm"
        />
      ) : (
        <div
          className="h-[70px] w-[50px] rounded-[7px] border border-dashed"
          style={{ borderColor: 'var(--pp-line)' }}
        />
      )}

      <div className="flex max-w-[108px] items-center gap-1.5">
        <Avatar seed={props.participantId} size={24} animated />
        <span className="truncate text-xs" style={{ color: 'var(--color-neutral-100)' }}>
          {props.isViewer ? 'Tú' : props.displayName}
        </span>
        {props.isDealer ? (
          <span
            className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'var(--color-neutral-200)', color: '#1b1d2c' }}
          >
            D
          </span>
        ) : null}
      </div>

      {props.badge === 'feather' ? (
        <span
          className="max-w-[104px] truncate rounded-full border px-2 py-[3px] text-[10px]"
          style={{ borderColor: 'var(--color-neutral-400)', color: 'var(--color-neutral-100)' }}
        >
          🐔 Cobarde
        </span>
      ) : null}
      {props.badge === 'cape' ? (
        <span
          className="max-w-[104px] truncate rounded-full border px-2 py-[3px] text-[10px]"
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

function CapeOverlay(): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1.5 h-[74px] w-16 opacity-85"
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
