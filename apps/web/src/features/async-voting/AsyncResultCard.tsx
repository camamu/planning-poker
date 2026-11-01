import type { AsyncRoundView, RoundResultView } from '@pp/contracts';
import type { JSX } from 'react';
import { useState } from 'react';
import { Button, Select } from '../../design-system/index.js';
import { Distribution } from '../results-panel/Distribution.js';
import { formatPoints } from '../session-summary/summaryFormat.js';
import type { AsyncEntry } from './asyncQueue.js';
import type { AsyncVotingProps } from './types.js';

export interface AsyncResultCardProps {
  readonly entry: AsyncEntry;
  readonly asyncVoting: AsyncVotingProps;
  /** Hay hueco en la mesa para discutirla en vivo. */
  readonly canStartLive: boolean;
  readonly onStartLive: (issueId: string) => void;
}

function Figure({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <span>
      {label}{' '}
      <strong className="font-mono text-sm" style={{ color: 'var(--color-text)' }}>
        {value}
      </strong>
    </span>
  );
}

function ResultSummary({
  result,
  round,
  asyncVoting,
}: {
  readonly result: RoundResultView;
  readonly round: AsyncRoundView;
  readonly asyncVoting: AsyncVotingProps;
}): JSX.Element {
  const nameOf = (participantId: string): string =>
    asyncVoting.participants.find((participant) => participant.id === participantId)?.displayName ??
    '—';

  return (
    <>
      <div className="flex gap-4 text-xs" style={{ color: 'var(--pp-muted)' }}>
        {result.average !== null ? (
          <Figure label="Media" value={formatPoints(result.average)} />
        ) : (
          <Figure label="Más votada" value={result.mostVoted ?? '—'} />
        )}
        <Figure label="Acuerdo" value={`${result.agreementPercentage.toString()}%`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Distribution result={result} total={round.votes.length} />
      </div>
      <ul className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Votos de cada persona">
        {round.votes.map((vote) => (
          <li
            key={vote.participantId}
            className="rounded-full px-2 py-0.5"
            style={{ border: '1px solid var(--pp-line)' }}
          >
            {nameOf(vote.participantId)} · <span className="font-mono">{vote.card}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function AcceptEstimate({
  suggested,
  deckCards,
  onAccept,
}: {
  readonly suggested: string | null;
  readonly deckCards: ReadonlyArray<string>;
  readonly onAccept: (card: string) => void;
}): JSX.Element {
  const [chosen, setChosen] = useState<string | null>(null);
  const card = chosen ?? suggested;

  return (
    <div className="flex items-end gap-2">
      <Select
        label="Estimación"
        value={card ?? ''}
        options={deckCards.map((deckCard) => ({ value: deckCard, label: deckCard }))}
        onChange={(event) => {
          setChosen(event.target.value);
        }}
      />
      <Button
        variant="primary"
        disabled={card === null}
        onClick={() => {
          if (card !== null) onAccept(card);
        }}
      >
        Aceptar
      </Button>
    </div>
  );
}

export function AsyncResultCard({
  entry,
  asyncVoting,
  canStartLive,
  onStartLive,
}: AsyncResultCardProps): JSX.Element {
  const { issue, round } = entry;
  const result = round.result;

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[10px] p-3"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-divider)' }}
    >
      <span className="truncate text-sm font-semibold" title={issue.title}>
        {issue.title}
      </span>

      {result ? <ResultSummary result={result} round={round} asyncVoting={asyncVoting} /> : null}

      {asyncVoting.canReveal ? (
        <AcceptEstimate
          // La media puede no ser una carta de la baraja (0.5 y 1 promedian 0.75): se propone la más
          // votada, que siempre lo es, como en el resultado de la mesa.
          suggested={result?.mostVoted ?? asyncVoting.deckCards[0] ?? null}
          deckCards={asyncVoting.deckCards}
          onAccept={(card) => {
            asyncVoting.onAcceptEstimate(issue.id, card);
          }}
        />
      ) : (
        <span className="text-[11px]" style={{ color: 'var(--pp-muted)' }}>
          Solo quien puede revelar cierra la estimación.
        </span>
      )}
      {canStartLive ? (
        <Button
          variant="secondary"
          onClick={() => {
            onStartLive(issue.id);
          }}
        >
          Votar en vivo
        </Button>
      ) : null}
    </div>
  );
}
