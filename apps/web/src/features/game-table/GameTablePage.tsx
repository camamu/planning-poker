import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Toast } from '../../design-system/index.js';
import { addIssue } from '../../shared/api/gamesClient.js';
import {
  playImpactSound,
  playReactionSound,
  playRevealSound,
  playThrowSound,
  playVoteSound,
} from '../../shared/audio/sounds.js';
import { DeckSettingsPanel } from '../deck-settings/DeckSettingsPanel.js';
import { IssueListPanel } from '../issue-list/IssueListPanel.js';
import { ResultsPanel } from '../results-panel/ResultsPanel.js';
import { Hand } from './components/Hand.js';
import { Table } from './components/Table.js';
import { TopBar } from './components/TopBar.js';
import { useDiscussionTimer } from './hooks/useDiscussionTimer.js';
import { useEmojiThrow } from './hooks/useEmojiThrow.js';
import { useGameTable } from './hooks/useGameTable.js';

export interface GameTablePageProps {
  readonly gameId: string;
  readonly participantId: string;
}

export function GameTablePage({ gameId, participantId }: GameTablePageProps): JSX.Element {
  const table = useGameTable(gameId, participantId);
  const emoji = useEmojiThrow();
  const discussionTimer = useDiscussionTimer();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const previousEmojiCountRef = useRef(0);
  useEffect(() => {
    const latest = emoji.emojisInFlight.at(-1);
    if (emoji.emojisInFlight.length > previousEmojiCountRef.current && latest) {
      if (latest.fromParticipantId === participantId) playThrowSound(table.muted);
      else playImpactSound(table.muted);
      if (latest.toParticipantId === latest.fromParticipantId) playReactionSound(table.muted);
    }
    previousEmojiCountRef.current = emoji.emojisInFlight.length;
  }, [emoji.emojisInFlight, participantId, table.muted]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', table.theme);
  }, [table.theme]);

  const previousRoundStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousRoundStatusRef.current === 'OPEN' && table.round?.status === 'REVEALED') {
      playRevealSound(table.round.result?.isUnanimous ?? false, table.muted);
    }
    previousRoundStatusRef.current = table.round?.status;
  }, [table.round?.status, table.round?.result?.isUnanimous, table.muted]);

  useEffect(() => {
    if (!table.game || !table.errorMessage) return;
    const timeout = setTimeout(table.clearError, 4000);
    return () => {
      clearTimeout(timeout);
    };
  }, [table.game, table.errorMessage, table.clearError]);

  if (!table.game && table.errorMessage) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <p style={{ color: 'var(--color-text)' }}>{table.errorMessage}</p>
        <Link to="/">
          <Button variant="secondary">Volver al inicio</Button>
        </Link>
      </div>
    );
  }

  if (!table.game) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <p style={{ color: 'var(--pp-muted)' }}>Conectando con la mesa…</p>
      </div>
    );
  }

  const { game, round } = table;
  const nextPendingIssueId = game.issues.find((issue) => issue.status === 'PENDING')?.id ?? null;
  const me = game.participants.find((p) => p.id === participantId);
  const isMyTurnToVote = me?.role === 'VOTER';

  return (
    <div
      className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {table.status === 'disconnected' ? (
        <div
          className="flex flex-none items-center justify-center gap-2 py-1.5 text-xs"
          style={{ background: 'var(--color-accent-900)', color: 'var(--color-accent-200)' }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'currentColor', animation: 'ppPulse 1.4s ease-in-out infinite' }}
            aria-hidden="true"
          />
          Reconectando…
        </div>
      ) : null}
      <TopBar
        gameName={game.name}
        meta={`${(game.deck.cards.length - 2).toString()} valores · ${table.totalVoters.toString()} votantes · ${table.spectators.length.toString()} mirones`}
        remainingMs={round?.status === 'OPEN' ? table.remainingMs : null}
        muted={table.muted}
        onToggleMuted={table.toggleMuted}
        viewerId={participantId}
        onToggleIssues={() => {
          setIssuesOpen((open) => !open);
        }}
        onToggleSettings={
          me?.isFacilitator
            ? () => {
                setSettingsOpen((open) => !open);
              }
            : undefined
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_316px]">
        <div className="flex min-w-0 flex-col" style={{ background: 'var(--pp-felt)' }}>
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            {table.seats.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
                Todavía no hay nadie sentado a la mesa.
              </p>
            ) : (
              <Table
                game={game}
                round={round}
                seats={table.seats}
                viewerId={participantId}
                selectedCard={table.selectedCard}
                emojisInFlight={emoji.emojisInFlight}
                seatCursor={emoji.armedEmoji ? 'crosshair' : undefined}
                onSeatClick={emoji.armedEmoji ? emoji.throwAtSeat : undefined}
              />
            )}
          </div>

          <div className="flex flex-none items-center gap-2.5 px-7 pb-3">
            <span className="pp-kicker">Mirando desde la barrera</span>
            <div className="flex gap-2">
              {table.spectators.map((spectator) => (
                <div
                  key={spectator.id}
                  className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
                  style={{ border: '1px dashed var(--pp-line)' }}
                >
                  <Avatar seed={spectator.id} size={20} opacity={0.85} />
                  <span className="text-[11px]" style={{ color: 'var(--pp-muted)' }}>
                    {spectator.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {round && isMyTurnToVote ? (
            <Hand
              cards={game.deck.cards}
              selected={table.selectedCard}
              disabled={round.status !== 'OPEN'}
              hint={round.status === 'OPEN' ? 'Elige tu carta' : 'La ronda ya está revelada'}
              onSelect={(card) => {
                table.castVote(card);
                playVoteSound(table.muted);
              }}
              emoji={emoji}
              viewerId={participantId}
              throwEmojisEnabled={game.settings.throwEmojis}
            />
          ) : null}
        </div>

        <aside
          className="flex flex-col gap-4.5 border-t p-5 lg:overflow-hidden lg:border-l lg:border-t-0"
          style={{
            borderColor: 'var(--color-divider)',
            background: 'var(--color-surface)',
          }}
        >
          <ResultsPanel
            round={round}
            celebrate={game.settings.celebrate}
            votedCount={table.votedCount}
            totalVoters={table.totalVoters}
            remainingMs={table.remainingMs}
            canReveal={table.canReveal}
            onReveal={table.reveal}
            onRevote={() => {
              if (round) table.startRound(round.issueId);
            }}
            hasNextIssue={nextPendingIssueId !== null}
            onNextIssue={() => {
              if (nextPendingIssueId) table.startRound(nextPendingIssueId);
            }}
            discussionTimer={discussionTimer.timer}
            onStartDiscussionTimer={discussionTimer.start}
            onPauseDiscussionTimer={discussionTimer.pause}
            onResumeDiscussionTimer={discussionTimer.resume}
            onAddDiscussionSeconds={discussionTimer.addSeconds}
          />
        </aside>
      </div>

      {issuesOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="presentation"
          onClick={() => {
            setIssuesOpen(false);
          }}
        >
          <div
            className="h-full shadow-2xl"
            style={{ boxShadow: '-12px 0 30px rgba(0,0,0,.4)' }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <IssueListPanel
              issues={game.issues}
              currentIssueId={round?.issueId ?? null}
              canStartRound={round === null}
              onAddIssue={(title) => {
                void addIssue(gameId, { title });
              }}
              onStartRound={table.startRound}
              onClose={() => {
                setIssuesOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="presentation"
          onClick={() => {
            setSettingsOpen(false);
          }}
        >
          <div
            className="h-full shadow-2xl"
            style={{ boxShadow: '-12px 0 30px rgba(0,0,0,.4)' }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <DeckSettingsPanel
              gameId={gameId}
              participantId={participantId}
              settings={game.settings}
              onClose={() => {
                setSettingsOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {table.errorMessage ? (
        <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2">
          <Toast message={table.errorMessage} />
        </div>
      ) : null}
    </div>
  );
}
