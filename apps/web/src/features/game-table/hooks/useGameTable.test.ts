import type { GameView } from '@pp/contracts';
import type { RenderHookResult } from '@testing-library/react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberedGames } from '../../../shared/games/rememberedGames.js';
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
    { id: 'p1', displayName: 'Yo', role: 'VOTER', isFacilitator: true, online: true, hat: null },
    { id: 'p2', displayName: 'Otro', role: 'VOTER', isFacilitator: false, online: true, hat: null },
  ],
  issues: [],
  currentRound: {
    id: 'round-1',
    issueId: 'issue-1',
    roundNumber: 1,
    status: 'OPEN',
    votes: [{ participantId: 'p1', card: '5', hasVoted: true }],
    result: null,
    previousRounds: [],
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

const { removeParticipantRequest, transferFacilitatorRequest, claimFacilitatorRequest } =
  vi.hoisted(() => ({
    removeParticipantRequest: vi.fn(),
    transferFacilitatorRequest: vi.fn(),
    claimFacilitatorRequest: vi.fn(),
  }));
vi.mock('../../../shared/api/gamesClient.js', () => ({
  removeParticipant: removeParticipantRequest,
  transferFacilitator: transferFacilitatorRequest,
  claimFacilitator: claimFacilitatorRequest,
}));

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

  it('cuenta solo a los votantes conectados en "x de y han votado"', () => {
    const { result } = renderWith('p1', null);
    act(() => {
      useGameStore.setState({
        game: {
          ...baseGame,
          participants: [
            {
              id: 'p1',
              displayName: 'Yo',
              role: 'VOTER',
              isFacilitator: true,
              online: true,
              hat: null,
            },
            {
              id: 'p2',
              displayName: 'Otro',
              role: 'VOTER',
              isFacilitator: false,
              online: false,
              hat: null,
            },
          ],
        },
      });
    });

    expect(result.current.totalVoters).toBe(1);
    expect(result.current.votedCount).toBe(1);
  });

  it('mantiene en la mesa a los desconectados para poder quitarlos', () => {
    const { result } = renderWith('p1', null);
    act(() => {
      useGameStore.setState({
        game: {
          ...baseGame,
          participants: [
            {
              id: 'p1',
              displayName: 'Yo',
              role: 'VOTER',
              isFacilitator: true,
              online: true,
              hat: null,
            },
            {
              id: 'p2',
              displayName: 'Otro',
              role: 'VOTER',
              isFacilitator: false,
              online: false,
              hat: null,
            },
          ],
        },
      });
    });

    expect(result.current.seats.map((seat) => [seat.id, seat.online])).toEqual([
      ['p1', true],
      ['p2', false],
    ]);
  });

  it('indica si quien mira es el facilitador', () => {
    expect(renderWith('p1', null).result.current.isFacilitator).toBe(true);
    expect(renderWith('p2', null).result.current.isFacilitator).toBe(false);
  });

  it('al salir uno mismo muestra la pantalla de salida tras confirmarlo el servidor', async () => {
    removeParticipantRequest.mockResolvedValue(undefined);
    const { result } = renderWith('p2', null);

    await act(async () => {
      await result.current.removeParticipant('p2');
    });

    expect(removeParticipantRequest).toHaveBeenCalledWith('game-1', 'p2', 'p2');
    expect(result.current.hasLeft).toBe(true);
  });

  it('si el servidor rechaza quitar a alguien muestra el error y no marca la salida', async () => {
    removeParticipantRequest.mockRejectedValue(new Error('No puedes quitar a otro.'));
    const { result } = renderWith('p2', null);

    await act(async () => {
      await result.current.removeParticipant('p1');
    });

    expect(result.current.hasLeft).toBe(false);
    expect(result.current.errorMessage).toBe('No puedes quitar a otro.');
  });

  describe('partidas recientes', () => {
    // Sin esto siguen montados los hooks de los tests anteriores y también recuerdan su partida.
    beforeEach(() => {
      cleanup();
      localStorage.clear();
    });

    it('recuerda la partida al entrar en la sala para volver a ella desde la portada', () => {
      renderWith('p1', null);

      expect(rememberedGames().map((game) => [game.id, game.name])).toEqual([
        ['game-1', 'Partida'],
      ]);
    });

    it('no recuerda la partida mientras el estado cargado es el de otra sala', () => {
      renderHook(() => useGameTable('game-2', 'p1'));
      act(() => {
        useGameStore.setState({ game: baseGame });
      });

      expect(rememberedGames()).toEqual([]);
    });
  });

  describe('traspaso de facilitador', () => {
    function withFacilitatorOnline(online: boolean, status: 'connected' | 'disconnected'): void {
      act(() => {
        useGameStore.setState({
          status,
          game: {
            ...baseGame,
            participants: baseGame.participants.map((participant) =>
              participant.isFacilitator ? { ...participant, online } : participant,
            ),
          },
        });
      });
    }

    it('ofrece tomar el relevo a quien mira cuando el facilitador está desconectado', () => {
      const { result } = renderWith('p2', null);
      withFacilitatorOnline(false, 'connected');

      expect(result.current.facilitatorAbsent).toBe(true);
      expect(result.current.facilitatorName).toBe('Yo');
    });

    it('no ofrece el relevo si el facilitador está conectado', () => {
      const { result } = renderWith('p2', null);
      withFacilitatorOnline(true, 'connected');

      expect(result.current.facilitatorAbsent).toBe(false);
    });

    it('no se ofrece el relevo a sí mismo el propio facilitador', () => {
      const { result } = renderWith('p1', null);
      withFacilitatorOnline(false, 'connected');

      expect(result.current.facilitatorAbsent).toBe(false);
    });

    it('no ofrece el relevo con el socket propio caído, porque la presencia que ve está obsoleta', () => {
      const { result } = renderWith('p2', null);
      withFacilitatorOnline(false, 'disconnected');

      expect(result.current.facilitatorAbsent).toBe(false);
    });

    it('tomar el relevo pide al servidor el relevo en nombre de quien mira', async () => {
      claimFacilitatorRequest.mockResolvedValue(undefined);
      const { result } = renderWith('p2', null);

      await act(async () => {
        await result.current.claimFacilitator();
      });

      expect(claimFacilitatorRequest).toHaveBeenCalledWith('game-1', { participantId: 'p2' });
    });

    it('si el servidor rechaza el relevo muestra el motivo', async () => {
      claimFacilitatorRequest.mockRejectedValue(new Error('El facilitador sigue conectado.'));
      const { result } = renderWith('p2', null);

      await act(async () => {
        await result.current.claimFacilitator();
      });

      expect(result.current.errorMessage).toBe('El facilitador sigue conectado.');
    });

    it('ceder el rol manda quién lo cede y quién lo recibe', async () => {
      transferFacilitatorRequest.mockResolvedValue(undefined);
      const { result } = renderWith('p1', null);

      await act(async () => {
        await result.current.transferFacilitator('p2');
      });

      expect(transferFacilitatorRequest).toHaveBeenCalledWith('game-1', {
        participantId: 'p1',
        toParticipantId: 'p2',
      });
    });

    it('el facilitador que sale cede el rol primero y solo entonces se marca como salido', async () => {
      const calls: string[] = [];
      transferFacilitatorRequest.mockImplementation(() => {
        calls.push('transfer');
        return Promise.resolve();
      });
      removeParticipantRequest.mockImplementation(() => {
        calls.push('remove');
        return Promise.resolve();
      });
      const { result } = renderWith('p1', null);

      await act(async () => {
        await result.current.leaveAsFacilitator('p2');
      });

      expect(calls).toEqual(['transfer', 'remove']);
      expect(removeParticipantRequest).toHaveBeenCalledWith('game-1', 'p1', 'p1');
      expect(result.current.hasLeft).toBe(true);
    });

    it('si no se puede ceder el rol, el facilitador no sale y ve el motivo', async () => {
      transferFacilitatorRequest.mockRejectedValue(new Error('No existe el participante p9.'));
      removeParticipantRequest.mockClear();
      const { result } = renderWith('p1', null);

      await act(async () => {
        await result.current.leaveAsFacilitator('p9');
      });

      expect(removeParticipantRequest).not.toHaveBeenCalled();
      expect(result.current.hasLeft).toBe(false);
      expect(result.current.errorMessage).toBe('No existe el participante p9.');
    });
  });
});
