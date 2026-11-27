import type { GameView, HatIdView, RoundView } from '@pp/contracts';
import type { JSX } from 'react';
import { useRef } from 'react';
import { useSeason } from '../../../shared/season/season.js';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import { useContainerSize } from '../hooks/useContainerSize.js';
import { computeResultBadges } from '../resultBadges.js';
import { compactRows, compactSeatPosition, computeThrowOffset } from '../seatLayout.js';
import type { SeatPosition, ThrowOffset } from '../seatLayout.js';
import { EmojiThrowLayer } from './EmojiThrowLayer.js';
import { ParticipantSeat } from './ParticipantSeat.js';
import { TableLights } from './TableLights.js';

export interface TableProps {
  readonly game: GameView;
  readonly round: RoundView | null;
  readonly seats: ReadonlyArray<{
    readonly id: string;
    readonly displayName: string;
    readonly online: boolean;
    readonly hat: HatIdView | null;
    readonly isFacilitator: boolean;
    readonly seat: SeatPosition;
  }>;
  readonly viewerId: string;
  readonly selectedCard: string | null;
  readonly emojisInFlight?: ReadonlyArray<EmojiInFlight> | undefined;
  readonly onSeatClick?: ((participantId: string) => void) | undefined;
  readonly seatCursor?: string | undefined;
  /** Solo para el facilitador: quitar a otro participante de la mesa. */
  readonly onRemoveSeat?: ((participantId: string) => void) | undefined;
  /** Solo para el facilitador: ceder el rol al participante de ese asiento. */
  readonly onMakeFacilitatorSeat?: ((participantId: string) => void) | undefined;
  /**
   * Solo para el facilitador en el móvil: tocar un asiento ajeno abre sus acciones, en vez de los
   * botones 🔑 y ✕ de cada asiento, que allí no llegan al mínimo táctil (ADR 0032).
   */
  readonly onSeatActions?: ((participantId: string) => void) | undefined;
  /**
   * Móvil en vertical (docs/06-handoff-diseno.md §8): la tarea va encima de la mesa y los asientos
   * en una rejilla de cuatro columnas en vez de en elipse (ADR 0032).
   */
  readonly compact?: boolean | undefined;
}

/** Alto de cada fila de la rejilla compacta: carta, nombre e insignia de un asiento sin pisarse. */
const COMPACT_ROW_PX = 104;
/** Con una sola fila el óvalo quedaría tan plano que el asiento asomaría por arriba y por abajo. */
const COMPACT_MIN_HEIGHT_PX = 150;

export function Table({
  game,
  round,
  seats,
  viewerId,
  selectedCard,
  emojisInFlight = [],
  onSeatClick,
  seatCursor,
  onRemoveSeat,
  onMakeFacilitatorSeat,
  onSeatActions,
  compact = false,
}: TableProps): JSX.Element {
  const issue = round ? game.issues.find((candidate) => candidate.id === round.issueId) : undefined;
  const revealed = round?.status === 'REVEALED' || round?.status === 'CLOSED';
  const badges =
    round && revealed
      ? computeResultBadges(round.votes)
      : { feathers: new Set<string>(), capes: new Set<string>() };

  const season = useSeason();
  const votedIds = new Set(round?.votes.map((vote) => vote.participantId) ?? []);

  const placedSeats = compact
    ? seats.map((seat, index) => ({ ...seat, seat: compactSeatPosition(index, seats.length) }))
    : seats;
  const seatsById = new Map(placedSeats.map((seat) => [seat.id, seat.seat]));
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(containerRef);
  const flightGeometryById = new Map<string, ThrowOffset>();
  if (containerSize) {
    for (const entry of emojisInFlight) {
      if (entry.toParticipantId === null || entry.toParticipantId === entry.fromParticipantId)
        continue;
      const from = seatsById.get(entry.fromParticipantId);
      const to = seatsById.get(entry.toParticipantId);
      if (!from || !to) continue;
      flightGeometryById.set(entry.id, computeThrowOffset(from, to, containerSize));
    }
  }

  const seatElements = (
    <>
      {placedSeats.map((seat) => {
        const vote = round?.votes.find((candidate) => candidate.participantId === seat.id);
        return (
          <ParticipantSeat
            key={seat.id}
            participantId={seat.id}
            displayName={seat.displayName}
            seat={seat.seat}
            compact={compact}
            isDealer={round?.dealerId === seat.id}
            isViewer={seat.id === viewerId}
            online={seat.online}
            hat={seat.hat}
            isFacilitator={seat.isFacilitator}
            onMakeFacilitator={
              onMakeFacilitatorSeat && seat.id !== viewerId
                ? () => {
                    onMakeFacilitatorSeat(seat.id);
                  }
                : undefined
            }
            onRemove={
              onRemoveSeat && seat.id !== viewerId
                ? () => {
                    onRemoveSeat(seat.id);
                  }
                : undefined
            }
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
                    value: seat.id === viewerId ? (selectedCard ?? vote.card) : vote.card,
                  }
                : null
            }
            onClick={
              onSeatClick
                ? () => {
                    onSeatClick(seat.id);
                  }
                : onSeatActions && seat.id !== viewerId
                  ? () => {
                      onSeatActions(seat.id);
                    }
                  : undefined
            }
          />
        );
      })}

      <EmojiThrowLayer
        emojisInFlight={emojisInFlight}
        seatsById={seatsById}
        flightGeometryById={flightGeometryById}
      />
    </>
  );

  if (compact) {
    const height = Math.max(COMPACT_MIN_HEIGHT_PX, compactRows(seats.length) * COMPACT_ROW_PX);
    return (
      <div className="flex w-full flex-col gap-3">
        <IssueHeading game={game} round={round} issue={issue} compact />
        <div ref={containerRef} className="relative w-full" style={{ height, cursor: seatCursor }}>
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '44% / 26%',
              background:
                'radial-gradient(120% 100% at 50% 34%,var(--color-accent-800) 0%,var(--color-accent-900) 55%,#1b1d2c 100%)',
              boxShadow:
                'inset 0 0 0 1px var(--color-accent-700), inset 0 14px 40px rgba(0,0,0,.45)',
            }}
          />
          {season === 'winter' ? (
            <TableLights
              seats={placedSeats}
              votedIds={votedIds}
              revealed={revealed}
              compactAspect={containerSize ? containerSize.width / containerSize.height : 1.5}
            />
          ) : null}
          {seatElements}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
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
      {season === 'winter' ? (
        <TableLights seats={seats} votedIds={votedIds} revealed={revealed} />
      ) : null}

      <div className="absolute left-1/2 top-1/2 flex w-[400px] max-w-[85%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 text-center">
        <IssueHeading game={game} round={round} issue={issue} compact={false} />
      </div>

      {seatElements}
    </div>
  );
}

/** Qué se está estimando: en el centro de la mesa, o encima de ella en el móvil. */
function IssueHeading({
  game,
  round,
  issue,
  compact,
}: {
  readonly game: GameView;
  readonly round: RoundView | null;
  readonly issue: GameView['issues'][number] | undefined;
  readonly compact: boolean;
}): JSX.Element {
  const kicker = round ? 'Estimando ahora' : 'Sin ronda abierta';
  return (
    <div className={compact ? 'flex flex-col items-center gap-1.5 px-2 text-center' : 'contents'}>
      <div className="pp-kicker" style={{ color: 'var(--color-accent-300)' }}>
        {/* En el móvil el título va justo debajo: repetirlo en el kicker solo lo partiría. */}
        {compact ? kicker : `${kicker} · ${issue?.title ?? game.name}`}
      </div>
      {issue ? (
        <h2
          className={compact ? 'line-clamp-2 text-base font-medium' : 'line-clamp-3 text-xl'}
          style={{ color: 'var(--color-neutral-100)' }}
        >
          {issue.title}
        </h2>
      ) : (
        <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
          Todavía no hay ninguna tarea en votación.
        </p>
      )}
      {round ? (
        <div
          className={`rounded-full font-medium ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
          style={{
            border: '1px solid var(--color-accent-400)',
            color: 'var(--color-accent-300)',
          }}
        >
          Ronda {round.roundNumber}
        </div>
      ) : null}
    </div>
  );
}
