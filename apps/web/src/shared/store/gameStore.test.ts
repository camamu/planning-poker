import type { GameSettingsView, GameView } from '@pp/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asyncRoundView } from '../testing/viewFixtures.js';
import { useGameStore } from './gameStore.js';

const { handlers, emit } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
  emit: vi.fn(),
}));

vi.mock('../socket/connection.js', () => ({
  getSocket: () => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit,
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
    },
  }),
}));

function baseGame(): GameView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    deck: { cards: ['1', '2', '?', '☕'] },
    settings: baseSettings(),
    participants: [],
    issues: [],
    currentRound: null,
    asyncRounds: [],
  };
}

function baseSettings(): GameSettingsView {
  return {
    autoReveal: false,
    whoCanReveal: 'ANYONE',
    namedRevealers: [],
    allowVoteChange: true,
    celebrate: true,
    throwEmojis: false,
    countdownSeconds: null,
    revealOnTimeout: false,
  };
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      status: 'idle',
      game: null,
      version: 0,
      gameId: null,
      participantId: null,
      errorMessage: null,
      selectedCard: null,
      asyncSelected: {},
      hasLeft: false,
      theme: 'dark',
      muted: false,
    });
  });

  it('toggleTheme alterna entre dark y light', () => {
    useGameStore.getState().toggleTheme();
    expect(useGameStore.getState().theme).toBe('light');
    useGameStore.getState().toggleTheme();
    expect(useGameStore.getState().theme).toBe('dark');
  });

  it('toggleMuted alterna el silencio', () => {
    useGameStore.getState().toggleMuted();
    expect(useGameStore.getState().muted).toBe(true);
  });

  it('castVote sin gameId/participantId (todavía no conectado) no hace nada', () => {
    useGameStore.getState().castVote('5');
    expect(useGameStore.getState().selectedCard).toBeNull();
  });

  it('connect() fija gameId/participantId y pasa a "connecting"', () => {
    useGameStore.getState().connect('game-1', 'p1');
    const state = useGameStore.getState();
    expect(state.gameId).toBe('game-1');
    expect(state.participantId).toBe('p1');
    expect(state.status).toBe('connecting');
  });

  it('cada conexión del socket, también una reconexión automática, vuelve a unirse a la partida', () => {
    useGameStore.getState().connect('game-1', 'p1');
    const onConnect = handlers.get('connect');
    emit.mockClear();

    onConnect?.(undefined);
    onConnect?.(undefined);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
  });

  it('presence_changed marca a un participante como conectado o desconectado', () => {
    useGameStore.setState({
      game: {
        ...baseGame(),
        participants: [
          {
            id: 'p1',
            displayName: 'Ada',
            role: 'VOTER',
            isFacilitator: true,
            online: true,
            hat: null,
          },
          {
            id: 'p2',
            displayName: 'Grace',
            role: 'VOTER',
            isFacilitator: false,
            online: true,
            hat: null,
          },
        ],
      },
    });

    handlers.get('presence_changed')?.({
      type: 'presence_changed',
      participantId: 'p2',
      online: false,
    });

    expect(useGameStore.getState().game?.participants.map((p) => p.online)).toEqual([true, false]);
  });

  it('left_game marca que el propio participante ya no está en la partida', () => {
    handlers.get('left_game')?.({ type: 'left_game' });
    expect(useGameStore.getState().hasLeft).toBe(true);
  });

  it('participant_left del propio participante muestra la salida y no pide resincronizar', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    handlers.get('participant_left')?.({
      type: 'participant_left',
      version: 1,
      participantId: 'p1',
    });

    expect(useGameStore.getState().hasLeft).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it('participant_left de otro participante pide un state_sync fresco', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    handlers.get('participant_left')?.({
      type: 'participant_left',
      version: 1,
      participantId: 'p2',
    });

    expect(useGameStore.getState().hasLeft).toBe(false);
    expect(emit).toHaveBeenCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
  });

  it('issues_imported pide un único state_sync fresco para toda la importación', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    handlers.get('issues_imported')?.({
      type: 'issues_imported',
      version: 1,
      issueIds: ['issue-1', 'issue-2', 'issue-3'],
    });

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
  });

  it('connect() reinicia version a 0 al cambiar de partida', () => {
    useGameStore.setState({ version: 12 });
    useGameStore.getState().connect('game-2', 'p1');
    expect(useGameStore.getState().version).toBe(0);
  });

  it('un settings_changed con version <= la actual se descarta (evento desordenado o duplicado)', () => {
    useGameStore.setState({ version: 5 });
    const settingsChanged = handlers.get('settings_changed');
    expect(settingsChanged).toBeDefined();

    settingsChanged?.({
      type: 'settings_changed',
      version: 5,
      settings: { ...baseSettings(), throwEmojis: true },
    });

    const state = useGameStore.getState();
    expect(state.version).toBe(5);
    expect(state.game).toBeNull();
  });

  it('un settings_changed con version mayor que la actual sí se aplica', () => {
    useGameStore.setState({ version: 5 });
    const settingsChanged = handlers.get('settings_changed');

    settingsChanged?.({
      type: 'settings_changed',
      version: 6,
      settings: { ...baseSettings(), throwEmojis: true },
    });

    expect(useGameStore.getState().version).toBe(6);
  });

  it('el primer state_sync con version 0 se aplica (partida sin eventos o API recién reiniciada)', () => {
    useGameStore.getState().connect('game-1', 'p1');
    const stateSync = handlers.get('state_sync');
    expect(stateSync).toBeDefined();

    stateSync?.({ type: 'state_sync', version: 0, state: baseGame() });

    expect(useGameStore.getState().game?.id).toBe('game-1');
  });

  it('un state_sync con version menor que la actual se aplica (el contador del servidor vive en memoria y se reinicia)', () => {
    useGameStore.setState({ version: 12 });
    const stateSync = handlers.get('state_sync');

    stateSync?.({ type: 'state_sync', version: 3, state: baseGame() });

    const state = useGameStore.getState();
    expect(state.game?.id).toBe('game-1');
    expect(state.version).toBe(3);
  });

  it('game_closed deja la mesa sin partida y con el aviso de que la sala se ha cerrado', () => {
    useGameStore.setState({ game: baseGame(), selectedCard: '3' });

    handlers.get('game_closed')?.({ type: 'game_closed' });

    const state = useGameStore.getState();
    expect(state.game).toBeNull();
    expect(state.selectedCard).toBeNull();
    expect(state.errorMessage).toMatch(/administrador/);
  });
});

describe('gameStore: votación en diferido', () => {
  beforeEach(() => {
    useGameStore.setState({
      status: 'idle',
      game: null,
      version: 0,
      gameId: null,
      participantId: null,
      errorMessage: null,
      selectedCard: null,
      asyncSelected: {},
    });
    emit.mockClear();
  });

  it('castAsyncVote pinta la carta propia ya y la manda al servidor', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    useGameStore.getState().castAsyncVote('issue-2', '8');

    expect(useGameStore.getState().asyncSelected).toEqual({ 'issue-2': '8' });
    expect(emit).toHaveBeenCalledWith('async_vote', {
      gameId: 'game-1',
      participantId: 'p1',
      issueId: 'issue-2',
      card: '8',
    });
  });

  it('castAsyncVote sin conexión (sin gameId) no hace nada', () => {
    useGameStore.getState().castAsyncVote('issue-2', '8');

    expect(useGameStore.getState().asyncSelected).toEqual({});
    expect(emit).not.toHaveBeenCalled();
  });

  it('openAsyncRounds y revealAsync mandan sus comandos', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    useGameStore.getState().openAsyncRounds(['a', 'b']);
    useGameStore.getState().revealAsync();
    useGameStore.getState().revealAsync(['a']);

    expect(emit).toHaveBeenNthCalledWith(1, 'open_async_rounds', {
      gameId: 'game-1',
      participantId: 'p1',
      issueIds: ['a', 'b'],
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'reveal_async', {
      gameId: 'game-1',
      participantId: 'p1',
    });
    expect(emit).toHaveBeenNthCalledWith(3, 'reveal_async', {
      gameId: 'game-1',
      participantId: 'p1',
      issueIds: ['a'],
    });
  });

  it('setFinalEstimate con tarea manda su issueId y sin ella lo omite', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    useGameStore.getState().setFinalEstimate('5', 'issue-2');
    useGameStore.getState().setFinalEstimate('8');

    expect(emit).toHaveBeenNthCalledWith(1, 'set_estimate', {
      gameId: 'game-1',
      participantId: 'p1',
      card: '5',
      issueId: 'issue-2',
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'set_estimate', {
      gameId: 'game-1',
      participantId: 'p1',
      card: '8',
    });
  });

  it('async_vote_cast actualiza quién ha votado sin pedir un state_sync', () => {
    useGameStore.getState().connect('game-1', 'p1');
    useGameStore.setState({ game: { ...baseGame(), asyncRounds: [asyncRoundView('issue-2')] } });
    emit.mockClear();

    handlers.get('async_vote_cast')?.({
      type: 'async_vote_cast',
      version: 1,
      issueId: 'issue-2',
      participantId: 'p2',
    });

    expect(useGameStore.getState().game?.asyncRounds[0]?.voterIds).toEqual(['p2']);
    expect(emit).not.toHaveBeenCalled();
  });

  it('abrir y revelar en lote piden un state_sync fresco', () => {
    useGameStore.getState().connect('game-1', 'p1');

    for (const [index, type] of (
      ['async_rounds_opened', 'async_rounds_revealed'] as const
    ).entries()) {
      emit.mockClear();
      handlers.get(type)?.({ type, version: index + 1, issueIds: ['issue-2'] });
      expect(emit).toHaveBeenCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
    }
  });

  it('un state_sync sustituye los votos pintados por los confirmados por el servidor', () => {
    useGameStore.getState().connect('game-1', 'p1');
    useGameStore.getState().castAsyncVote('issue-2', '8');

    handlers.get('state_sync')?.({
      type: 'state_sync',
      version: 4,
      state: {
        ...baseGame(),
        asyncRounds: [asyncRoundView('issue-2', { voterIds: ['p1'], ownCard: '8' })],
      },
    });

    expect(useGameStore.getState().asyncSelected).toEqual({});
    expect(useGameStore.getState().game?.asyncRounds[0]?.ownCard).toBe('8');
  });

  it('un error con votos pintados sin confirmar pide la foto real, por si uno fue el rechazado', () => {
    useGameStore.getState().connect('game-1', 'p1');
    useGameStore.getState().castAsyncVote('issue-2', '8');
    emit.mockClear();

    handlers.get('error')?.({ message: 'No permitido.' });

    expect(useGameStore.getState().errorMessage).toBe('No permitido.');
    expect(emit).toHaveBeenCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
  });

  it('un error sin votos pintados no pide ninguna resincronización', () => {
    useGameStore.getState().connect('game-1', 'p1');
    emit.mockClear();

    handlers.get('error')?.({ message: 'No permitido.' });

    expect(emit).not.toHaveBeenCalled();
  });

  it('cambiar la baraja descarta los votos pintados: la carta puede no existir en la nueva', () => {
    useGameStore.getState().connect('game-1', 'p1');
    useGameStore.setState({ game: baseGame() });
    useGameStore.getState().castAsyncVote('issue-2', '8');

    handlers.get('deck_changed')?.({
      type: 'deck_changed',
      version: 1,
      deck: { cards: ['S', 'M'] },
    });

    expect(useGameStore.getState().asyncSelected).toEqual({});
  });
});
