import type { PastRoundView, RoundResultView, RoundView } from '@pp/contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultsPanel } from './ResultsPanel.js';
import type { ResultsPanelProps } from './ResultsPanel.js';

const result = (distribution: Record<string, number>, mostVoted: string): RoundResultView => ({
  distribution,
  average: null,
  agreementPercentage: 50,
  mostVoted,
  isUnanimous: false,
});

const PREVIOUS: PastRoundView = {
  id: 'round-1',
  roundNumber: 1,
  votes: [
    { participantId: 'ana', card: '3' },
    { participantId: 'bea', card: '8' },
  ],
  result: result({ '3': 1, '8': 1 }, '3'),
};

function revealedRound(overrides: Partial<RoundView> = {}): RoundView {
  return {
    id: 'round-2',
    issueId: 'issue-1',
    roundNumber: 2,
    status: 'REVEALED',
    votes: [
      { participantId: 'ana', card: '5', hasVoted: true },
      { participantId: 'bea', card: '8', hasVoted: true },
    ],
    result: result({ '5': 1, '8': 1 }, '5'),
    previousRounds: [PREVIOUS],
    dealerId: null,
    timerDeadline: null,
    ...overrides,
  };
}

function renderPanel(round: RoundView, overrides: Partial<ResultsPanelProps> = {}): void {
  render(
    <ResultsPanel
      round={round}
      participants={[
        { id: 'ana', displayName: 'Ana' },
        { id: 'bea', displayName: 'Bea' },
      ]}
      onStartQuickRound={vi.fn()}
      celebrate={false}
      votedCount={2}
      totalVoters={2}
      remainingMs={null}
      canReveal
      onReveal={vi.fn()}
      onRevote={vi.fn()}
      canEstimate
      onAcceptEstimate={vi.fn()}
      hasNextIssue={false}
      onNextIssue={vi.fn()}
      sessionFinished={false}
      summaryHref="/games/game-1/summary"
      discussionTimer={null}
      onStartDiscussionTimer={vi.fn()}
      onPauseDiscussionTimer={vi.fn()}
      onResumeDiscussionTimer={vi.fn()}
      onAddDiscussionSeconds={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ResultsPanel: comparar con la ronda anterior', () => {
  afterEach(cleanup);

  it('al revelar la segunda ronda muestra la comparación y quién cambió su voto, sin acción extra', () => {
    renderPanel(revealedRound());

    const comparison = screen.getByRole('region', { name: 'Comparar con la ronda 1' });
    expect(within(comparison).getByText('Ronda 1')).toBeInTheDocument();
    expect(within(comparison).getByText('Ronda 2')).toBeInTheDocument();
    expect(within(comparison).getByText('Ana')).toBeInTheDocument();
    expect(within(comparison).getByText('3 → 5')).toBeInTheDocument();
    expect(within(comparison).queryByText('Bea')).not.toBeInTheDocument();
  });

  it('en la primera ronda de una tarea no muestra comparación y sí la distribución', () => {
    renderPanel(revealedRound({ roundNumber: 1, previousRounds: [] }));

    expect(screen.queryByText(/Comparar con la ronda/)).not.toBeInTheDocument();
    expect(screen.getByText('Distribución')).toBeInTheDocument();
  });

  it('con varias rondas anteriores compara con la inmediatamente anterior', () => {
    const second: PastRoundView = {
      id: 'round-2',
      roundNumber: 2,
      votes: [
        { participantId: 'ana', card: '5' },
        { participantId: 'bea', card: '5' },
      ],
      result: result({ '5': 2 }, '5'),
    };
    renderPanel(
      revealedRound({
        id: 'round-3',
        roundNumber: 3,
        previousRounds: [PREVIOUS, second],
        votes: [
          { participantId: 'ana', card: '5', hasVoted: true },
          { participantId: 'bea', card: '13', hasVoted: true },
        ],
        result: result({ '5': 1, '13': 1 }, '5'),
      }),
    );

    const comparison = screen.getByRole('region', { name: 'Comparar con la ronda 2' });
    expect(within(comparison).getByText('Bea')).toBeInTheDocument();
    expect(within(comparison).getByText('5 → 13')).toBeInTheDocument();
    expect(within(comparison).queryByText('Ana')).not.toBeInTheDocument();
  });

  it('dice que nadie ha cambiado su voto cuando las dos rondas coinciden', () => {
    renderPanel(
      revealedRound({
        votes: [
          { participantId: 'ana', card: '3', hasVoted: true },
          { participantId: 'bea', card: '8', hasVoted: true },
        ],
        result: result({ '3': 1, '8': 1 }, '3'),
      }),
    );

    expect(screen.getByText('Nadie ha cambiado su voto.')).toBeInTheDocument();
  });

  it('nombra como «Alguien que ya no está» a quien cambió su voto y ya salió de la partida', () => {
    renderPanel(revealedRound(), { participants: [{ id: 'bea', displayName: 'Bea' }] });

    const comparison = screen.getByRole('region', { name: 'Comparar con la ronda 1' });
    expect(within(comparison).getByText('Alguien que ya no está')).toBeInTheDocument();
    expect(within(comparison).getByText('3 → 5')).toBeInTheDocument();
  });

  it('con la ronda abierta no muestra la comparación aunque haya rondas anteriores', () => {
    renderPanel(
      revealedRound({
        status: 'OPEN',
        result: null,
        votes: [{ participantId: 'ana', card: '5', hasVoted: true }],
      }),
    );

    expect(screen.queryByText(/Comparar con la ronda/)).not.toBeInTheDocument();
    expect(screen.getByText('Quién ha votado')).toBeInTheDocument();
  });
});

describe('ResultsPanel: resumen de la sesión', () => {
  afterEach(cleanup);

  it('ofrece ver el resumen en otra pestaña cuando la sesión ha terminado', () => {
    renderPanel(revealedRound(), { sessionFinished: true });

    const link = screen.getByRole('link', { name: 'Ver resumen de la sesión' });
    expect(link).toHaveAttribute('href', '/games/game-1/summary');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('no lo ofrece mientras la sesión sigue en marcha', () => {
    renderPanel(revealedRound(), { sessionFinished: false });

    expect(
      screen.queryByRole('link', { name: 'Ver resumen de la sesión' }),
    ).not.toBeInTheDocument();
  });
});
