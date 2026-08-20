import type { GameView } from '@pp/contracts';
import type { RenderHookResult } from '@testing-library/react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../../shared/store/gameStore.js';
import type { UseGameTableResult } from './useGameTable.js';
import { useGameTable } from './useGameTable.js';

vi.mock('../../../shared/socket/connection.js', () => ({
  getSocket: () => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  }),
}));

const baseGame: GameView = {
  id: 'game-1',
  name: 'Partida',
  deck: { cards: ['5', '8'] },
  settings: {
    autoReveal: false,
    whoCanReveal: 'ANYONE',
    namedRevealers: [],
    allowVoteChange: true,
    celebrate: true,
    throwEmojis: false,
    countdownSeconds: null,
    revealOnTimeout: false,
  },
  participants: [
    { id: 'p1', displayName: 'Yo', role: 'VOTER', isFacilitator: true },
    { id: 'p2', displayName: 'Otro', role: 'VOTER', isFacilitator: false },
  ],
  issues: [],
  currentRound: {
    id: 'round-1',
    issueId: 'issue-1',
    roundNumber: 1,
    status: 'OPEN',
    votes: [{ participantId: 'p1', card: '5', hasVoted: true }],
    result: null,
    dealerId: null,
    timerDeadline: null,
  },
};

/** `connect()` corre en el efecto de montaje y limpia el estado, así que se siembra después. */
function renderWith(
  viewerId: string,
  selectedCard: string | null,
): RenderHookResult<UseGameTableResult, unknown> {
  const rendered = renderHook(() => useGameTable('game-1', viewerId));
  act(() => {
    useGameStore.setState({ game: baseGame, selectedCard });
  });
  return rendered;
}

describe('useGameTable', () => {
  it('recupera el voto propio del servidor cuando no hay voto optimista (recarga de página)', () => {
    const { result } = renderWith('p1', null);
    expect(result.current.selectedCard).toBe('5');
  });

  it('al cambiar de voto manda la carta recién elegida, no la última confirmada', () => {
    const { result } = renderWith('p1', '8');
    expect(result.current.selectedCard).toBe('8');
  });

  it('no expone como propio el voto de otro participante', () => {
    const { result } = renderWith('p2', null);
    expect(result.current.selectedCard).toBeNull();
  });
});
