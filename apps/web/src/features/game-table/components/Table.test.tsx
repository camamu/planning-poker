import type { GameView, ParticipantView, RoundView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderSeatsWithViewerAt } from '../seatLayout.js';
import { Table } from './Table.js';

const NAMES = ['Ana', 'Bea', 'Carla', 'Dani', 'Eva', 'Fran'];

const participants: ReadonlyArray<ParticipantView> = NAMES.map((name) => ({
  id: name.toLowerCase(),
  displayName: name,
  role: 'VOTER',
  isFacilitator: name === 'Ana',
  online: true,
  hat: null,
}));

const round: RoundView = {
  id: 'round-1',
  issueId: 'issue-1',
  roundNumber: 1,
  status: 'OPEN',
  votes: [],
  result: null,
  previousRounds: [],
  dealerId: null,
  timerDeadline: null,
};

const game: GameView = {
  id: 'game-1',
  name: 'Sprint 42',
  deck: { cards: ['1', '2', '3', '5', '8'] },
  settings: {
    autoReveal: true,
    whoCanReveal: 'ANYONE',
    namedRevealers: [],
    allowVoteChange: true,
    celebrate: true,
    throwEmojis: true,
    snow: true,
    countdownSeconds: null,
    revealOnTimeout: false,
  },
  participants,
  issues: [
    {
      id: 'issue-1',
      title: 'Pagar con Bizum',
      description: null,
      externalUrl: null,
      status: 'VOTING',
      finalEstimate: null,
    },
  ],
  currentRound: round,
  asyncRounds: [],
};

function renderTable(compact: boolean, onSeatActions?: (participantId: string) => void): void {
  render(
    <Table
      game={game}
      round={round}
      seats={orderSeatsWithViewerAt(participants, 'carla')}
      viewerId="carla"
      selectedCard={null}
      compact={compact}
      onSeatActions={onSeatActions}
    />,
  );
}

function seatOf(name: string): HTMLElement | null {
  return screen.getByText(name).closest('[data-snow-cap]');
}

describe('Table en el móvil', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sienta a todos en filas de cuatro, en el orden en que entraron', () => {
    renderTable(true);

    expect(seatOf('Ana')).toHaveStyle({ left: '12.5%', top: '25%' });
    expect(seatOf('Dani')).toHaveStyle({ left: '87.5%', top: '25%' });
    expect(seatOf('Eva')).toHaveStyle({ left: '37.5%', top: '75%' });
    expect(seatOf('Fran')).toHaveStyle({ left: '62.5%', top: '75%' });
  });

  it('pone la tarea encima de la mesa sin repetirla en el kicker', () => {
    renderTable(true);

    expect(screen.getByRole('heading', { name: 'Pagar con Bizum' })).toBeInTheDocument();
    expect(screen.getByText('Estimando ahora')).toBeInTheDocument();
  });

  it('en escritorio sigue sentándolos en elipse', () => {
    renderTable(false);

    expect(seatOf('Tú')).toHaveStyle({ left: '50%', top: '96%' });
    expect(screen.getByText('Estimando ahora · Pagar con Bizum')).toBeInTheDocument();
  });

  it('el facilitador abre las acciones tocando el asiento de otro, y no el suyo', () => {
    const onSeatActions = vi.fn();
    renderTable(true, onSeatActions);

    fireEvent.click(screen.getByText('Bea'));
    expect(onSeatActions).toHaveBeenCalledWith('bea');

    expect(seatOf('Tú')).not.toHaveAttribute('role', 'button');
  });
});
