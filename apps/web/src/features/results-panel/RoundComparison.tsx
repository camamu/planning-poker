import type { ParticipantView, PastRoundView, RoundResultView, RoundView } from '@pp/contracts';
import type { JSX } from 'react';
import { voteChanges } from './compareRounds.js';
import { Distribution } from './Distribution.js';

export const DEPARTED_PARTICIPANT_NAME = 'Alguien que ya no está';

export interface RoundComparisonProps {
  readonly previous: PastRoundView;
  readonly round: RoundView;
  readonly result: RoundResultView;
  readonly participants: ReadonlyArray<Pick<ParticipantView, 'id' | 'displayName'>>;
}

export function RoundComparison({
  previous,
  round,
  result,
  participants,
}: RoundComparisonProps): JSX.Element {
  const changes = voteChanges(previous, round.votes);
  const currentTotal = round.votes.filter((vote) => vote.card !== null).length;
  const nameOf = (participantId: string): string =>
    participants.find((participant) => participant.id === participantId)?.displayName ??
    DEPARTED_PARTICIPANT_NAME;

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={`Comparar con la ronda ${previous.roundNumber.toString()}`}
    >
      <span className="pp-kicker">Comparar con la ronda {previous.roundNumber}</span>

      <div className="flex flex-col gap-2">
        <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Ronda {previous.roundNumber}
        </span>
        <Distribution result={previous.result} total={previous.votes.length} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Ronda {round.roundNumber}
        </span>
        <Distribution result={result} total={currentTotal} />
      </div>

      {changes.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Nadie ha cambiado su voto.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {changes.map((change) => (
            <li key={change.participantId} className="flex items-baseline gap-1.5">
              <span>{nameOf(change.participantId)}</span>
              <span className="font-mono" style={{ color: 'var(--pp-muted)' }}>
                {change.from} → {change.to}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
