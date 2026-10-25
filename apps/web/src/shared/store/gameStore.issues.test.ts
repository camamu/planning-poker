import type { GameView, IssueView } from '@pp/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { editIssue, removeIssue, reorderIssues } from '../api/gamesClient.js';
import { useGameStore } from './gameStore.js';

const { emit, socket } = vi.hoisted(() => {
  const emit = vi.fn();
  return {
    emit,
    socket: { connected: true, connect: vi.fn(), disconnect: vi.fn(), emit, on: vi.fn() },
  };
});

vi.mock('../socket/connection.js', () => ({ getSocket: () => socket }));
vi.mock('../api/gamesClient.js', () => ({
  editIssue: vi.fn(),
  removeIssue: vi.fn(),
  reorderIssues: vi.fn(),
}));

const issue = (id: string, title: string, status: IssueView['status'] = 'PENDING'): IssueView => ({
  id,
  title,
  status,
  finalEstimate: null,
});

function gameWith(issues: ReadonlyArray<IssueView>): GameView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    deck: { cards: ['1', '2'] },
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
    participants: [],
    issues,
    currentRound: null,
  };
}

const titles = (): string[] => useGameStore.getState().game?.issues.map((i) => i.title) ?? [];

describe('gameStore: gestión de tareas', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    socket.connected = true;
    useGameStore.setState({
      game: gameWith([issue('a', 'Primera'), issue('b', 'Segunda'), issue('c', 'Tercera')]),
      gameId: 'game-1',
      participantId: 'p1',
      version: 3,
      errorMessage: null,
    });
  });

  it('renombrar pinta el título nuevo antes de que conteste la API', async () => {
    let answer: () => void = () => undefined;
    vi.mocked(editIssue).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const pending = useGameStore.getState().renameIssue('b', '  Segunda, corregida ');

    expect(titles()).toEqual(['Primera', 'Segunda, corregida', 'Tercera']);
    expect(editIssue).toHaveBeenCalledWith('game-1', 'b', {
      participantId: 'p1',
      title: 'Segunda, corregida',
    });
    answer();
    await pending;
    expect(useGameStore.getState().errorMessage).toBeNull();
  });

  it('si la API rechaza renombrar, devuelve el título anterior y avisa con el motivo', async () => {
    vi.mocked(editIssue).mockRejectedValue(new Error('La tarea no puede quedarse sin título.'));

    await useGameStore.getState().renameIssue('b', 'Otra cosa');

    expect(titles()).toEqual(['Primera', 'Segunda', 'Tercera']);
    expect(useGameStore.getState().errorMessage).toBe('La tarea no puede quedarse sin título.');
  });

  it('borrar quita la tarea ya y la devuelve a su sitio si la API lo rechaza', async () => {
    let fail: (reason: Error) => void = () => undefined;
    vi.mocked(removeIssue).mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );

    const pending = useGameStore.getState().deleteIssue('b');
    expect(titles()).toEqual(['Primera', 'Tercera']);

    fail(new Error('La tarea ya se ha votado.'));
    await pending;

    expect(titles()).toEqual(['Primera', 'Segunda', 'Tercera']);
    expect(useGameStore.getState().errorMessage).toBe('La tarea ya se ha votado.');
  });

  it('reordenar manda la cola entera en el orden nuevo y la pinta ya', async () => {
    vi.mocked(reorderIssues).mockResolvedValue(undefined);

    await useGameStore.getState().reorderIssueQueue(['c', 'a', 'b']);

    expect(titles()).toEqual(['Tercera', 'Primera', 'Segunda']);
    expect(reorderIssues).toHaveBeenCalledWith('game-1', {
      participantId: 'p1',
      issueIds: ['c', 'a', 'b'],
    });
  });

  it('si la API rechaza el orden, lo revierte y pide un state_sync (el cliente iba desfasado)', async () => {
    vi.mocked(reorderIssues).mockRejectedValue(new Error('Orden inválido.'));

    await useGameStore.getState().reorderIssueQueue(['c', 'a', 'b']);

    expect(titles()).toEqual(['Primera', 'Segunda', 'Tercera']);
    expect(emit).toHaveBeenCalledWith('join', { gameId: 'game-1', participantId: 'p1' });
  });

  it('si mientras tanto llegó otro cambio de la cola, un fallo no lo pisa', async () => {
    let fail: (reason: Error) => void = () => undefined;
    vi.mocked(removeIssue).mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const pending = useGameStore.getState().deleteIssue('b');
    const game = useGameStore.getState().game;
    if (!game) throw new Error('sin partida');
    useGameStore.setState({
      game: { ...game, issues: [...game.issues, issue('d', 'Cuarta, de otro')] },
    });

    fail(new Error('Fallo de red.'));
    await pending;

    expect(titles()).toEqual(['Primera', 'Tercera', 'Cuarta, de otro']);
  });

  it('sin conexión no pide state_sync al fallar', async () => {
    socket.connected = false;
    vi.mocked(removeIssue).mockRejectedValue(new Error('Sin red.'));

    await useGameStore.getState().deleteIssue('b');

    expect(emit).not.toHaveBeenCalled();
  });

  it('sin partida cargada no hace nada', async () => {
    useGameStore.setState({ game: null });

    await useGameStore.getState().deleteIssue('b');

    expect(removeIssue).not.toHaveBeenCalled();
  });
});
