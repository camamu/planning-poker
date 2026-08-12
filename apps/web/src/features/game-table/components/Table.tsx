import type { GameView, RoundView } from '@pp/contracts';
import type { JSX } from 'react';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import { computeResultBadges } from '../resultBadges.js';
import type { SeatPosition } from '../seatLayout.js';
import { EmojiThrowLayer } from './EmojiThrowLayer.js';
import { ParticipantSeat } from './ParticipantSeat.js';

export interface TableProps {
  readonly game: GameView;
  readonly round: RoundView | null;
  readonly seats: ReadonlyArray<{
    readonly id: string;
    readonly displayName: string;
    readonly seat: SeatPosition;
  }>;
  readonly viewerId: string;
  readonly selectedCard: string | null;
  readonly emojisInFlight?: ReadonlyArray<EmojiInFlight> | undefined;
  readonly onSeatClick?: ((participantId: string) => void) | undefined;
  readonly seatCursor?: string | undefined;
}

export function Table({
  game,
  round,
  seats,
  viewerId,
  selectedCard,
  emojisInFlight = [],
  onSeatClick,
  seatCursor,
}: TableProps): JSX.Element {
  const issue = round ? game.issues.find((candidate) => candidate.id === round.issueId) : undefined;
  const revealed = round?.status === 'REVEALED' || round?.status === 'CLOSED';
  const badges =
    round && revealed
      ? computeResultBadges(round.votes)
      : { feathers: new Set<string>(), capes: new Set<string>() };

  const seatsById = new Map(seats.map((seat) => [seat.id, seat.seat]));

  return (
    <div
      className="relative mx-auto aspect-[900/520] w-full max-w-[900px]"
      style={{ cursor: seatCursor }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(180deg,var(--color-neutral-800),var(--color-neutral-900))',
          boxShadow: '0 26px 60px rgba(0,0,0,.55), inset 0 2px 0 rgba(233,233,237,.06)',
        }}
      />
      <div
        className="absolute inset-[18px] rounded-full"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 32%,var(--color-accent-800) 0%,var(--color-accent-900) 55%,#1b1d2c 100%)',
          boxShadow: 'inset 0 0 0 1px var(--color-accent-700), inset 0 18px 50px rgba(0,0,0,.45)',
        }}
      />
      <div
        className="absolute inset-11 rounded-full"
        style={{ border: '1px solid rgba(145,132,217,.28)' }}
      />

      <div className="absolute left-1/2 top-1/2 flex w-[400px] max-w-[85%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 text-center">
        <div className="pp-kicker" style={{ color: 'var(--color-accent-300)' }}>
          {round ? 'Estimando ahora' : 'Sin ronda abierta'} · {issue?.title ?? game.name}
        </div>
        {issue ? (
          <h2 className="line-clamp-3 text-xl" style={{ color: 'var(--color-neutral-100)' }}>
            {issue.title}
          </h2>
        ) : (
          <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
            Todavía no hay ninguna tarea en votación.
          </p>
        )}
        {round ? (
          <div
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              border: '1px solid var(--color-accent-400)',
              color: 'var(--color-accent-300)',
            }}
          >
            Ronda {round.roundNumber}
          </div>
        ) : null}
      </div>

      {seats.map((seat) => {
        const vote = round?.votes.find((candidate) => candidate.participantId === seat.id);
        return (
          <ParticipantSeat
            key={seat.id}
            participantId={seat.id}
            displayName={seat.displayName}
            seat={seat.seat}
            isDealer={round?.dealerId === seat.id}
            isViewer={seat.id === viewerId}
            badge={
              badges.feathers.has(seat.id)
                ? 'feather'
                : badges.capes.has(seat.id)
                  ? 'cape'
                  : undefined
            }
            card={
              vote
                ? {
                    hasVoted: true,
                    value: seat.id === viewerId ? (vote.card ?? selectedCard) : vote.card,
                  }
                : null
            }
            onClick={
              onSeatClick
                ? () => {
                    onSeatClick(seat.id);
                  }
                : undefined
            }
          />
        );
      })}

      <EmojiThrowLayer emojisInFlight={emojisInFlight} seatsById={seatsById} />
    </div>
  );
}
