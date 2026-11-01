import type { JSX } from 'react';
import { useState } from 'react';
import { Button } from '../../design-system/index.js';
import { AsyncResultCard } from './AsyncResultCard.js';
import { AsyncVoteDialog } from './AsyncVoteDialog.js';
import { asyncQueue, revealableIssueIds, votedCount } from './asyncQueue.js';
import type { AsyncEntry } from './asyncQueue.js';
import type { AsyncVotingProps } from './types.js';
import type { IssueView } from '@pp/contracts';

export interface AsyncVotingSectionsProps {
  readonly issues: ReadonlyArray<IssueView>;
  readonly asyncVoting: AsyncVotingProps;
  readonly canStartRound: boolean;
  readonly onStartRound: (issueId: string) => void;
}

function Group(props: {
  readonly title: string;
  readonly action?: JSX.Element | null;
  readonly children: JSX.Element | ReadonlyArray<JSX.Element>;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="pp-kicker">{props.title}</span>
        {props.action}
      </div>
      <div className="flex flex-col gap-1.5">{props.children}</div>
    </div>
  );
}

function OpenRow(props: {
  readonly entry: AsyncEntry;
  readonly asyncVoting: AsyncVotingProps;
  readonly voterIds: ReadonlyArray<string>;
  readonly canStartLive: boolean;
  readonly onVote: () => void;
  readonly onStartLive: () => void;
}): JSX.Element {
  const { issue, round } = props.entry;
  const own = props.asyncVoting.pendingCards[issue.id] ?? round.ownCard;
  const hasVoted = own !== null || round.voterIds.includes(props.asyncVoting.viewerId);

  return (
    <div
      className="flex flex-col gap-1.5 rounded-[10px] px-3 py-2 text-sm"
      style={{ background: 'var(--color-bg)', border: '1px solid transparent' }}
    >
      <span className="truncate" title={issue.title}>
        {issue.title}
      </span>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span style={{ color: 'var(--pp-muted)' }}>
          {votedCount(round, props.voterIds).toString()} de {props.voterIds.length.toString()} han
          votado
        </span>
        {own !== null ? <span className="tag tag-accent">Tu voto: {own}</span> : null}
      </div>
      <div className="flex gap-1.5">
        {props.asyncVoting.viewerCanVote ? (
          <Button variant={hasVoted ? 'secondary' : 'primary'} onClick={props.onVote}>
            {hasVoted ? 'Cambiar voto' : 'Votar'}
          </Button>
        ) : null}
        {props.asyncVoting.canReveal && round.voterIds.length > 0 ? (
          <Button
            variant="secondary"
            aria-label={`Revelar «${issue.title}»`}
            onClick={() => {
              props.asyncVoting.onReveal([issue.id]);
            }}
          >
            Revelar
          </Button>
        ) : null}
        {props.canStartLive ? (
          <Button
            variant="secondary"
            aria-label={`Votar en vivo «${issue.title}»`}
            onClick={props.onStartLive}
          >
            Votar en vivo
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Las dos secciones del panel de tareas para la votación en diferido (ADR 0027): las rondas abiertas,
 * donde se vota y se revela, y las reveladas, donde se acepta una estimación o se pasa la tarea a la mesa.
 */
export function AsyncVotingSections(props: AsyncVotingSectionsProps): JSX.Element | null {
  const { asyncVoting } = props;
  const [votingIssueId, setVotingIssueId] = useState<string | null>(null);
  const queue = asyncQueue(props.issues, asyncVoting.rounds);
  const voterIds = asyncVoting.participants
    .filter((participant) => participant.role === 'VOTER')
    .map((participant) => participant.id);
  const revealable = revealableIssueIds(queue);
  const voting = queue.open.find(({ issue }) => issue.id === votingIssueId);

  if (queue.open.length === 0 && queue.revealed.length === 0) return null;

  return (
    <>
      {queue.open.length > 0 ? (
        <Group
          title="Votando en diferido"
          action={
            asyncVoting.canReveal && revealable.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  asyncVoting.onReveal();
                }}
              >
                Revelar todas
              </Button>
            ) : null
          }
        >
          {queue.open.map((entry) => (
            <OpenRow
              key={entry.round.roundId}
              entry={entry}
              asyncVoting={asyncVoting}
              voterIds={voterIds}
              canStartLive={props.canStartRound}
              onVote={() => {
                setVotingIssueId(entry.issue.id);
              }}
              onStartLive={() => {
                props.onStartRound(entry.issue.id);
              }}
            />
          ))}
        </Group>
      ) : null}

      {queue.revealed.length > 0 ? (
        <Group title="Resultados en diferido">
          {queue.revealed.map((entry) => (
            <AsyncResultCard
              key={entry.round.roundId}
              entry={entry}
              asyncVoting={asyncVoting}
              canStartLive={props.canStartRound}
              onStartLive={props.onStartRound}
            />
          ))}
        </Group>
      ) : null}

      <AsyncVoteDialog
        open={voting !== undefined}
        issueTitle={voting?.issue.title ?? ''}
        cards={asyncVoting.deckCards}
        selected={
          voting ? (asyncVoting.pendingCards[voting.issue.id] ?? voting.round.ownCard) : null
        }
        canChangeVote={asyncVoting.canChangeVote}
        onVote={(card) => {
          if (voting) asyncVoting.onVote(voting.issue.id, card);
        }}
        onClose={() => {
          setVotingIssueId(null);
        }}
      />
    </>
  );
}
