import type { GameView, ServerEvent } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { gameEventsReducer, needsResync } from './gameEventsReducer.js';

function baseState(overrides: Partial<GameView> = {}): GameView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    deck: { cards: ['1', '2', '3', '5', '8'] },
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
      { id: 'p1', displayName: 'Ada', role: 'VOTER', isFacilitator: true, online: true, hat: null },
      {
        id: 'p2',
        displayName: 'Grace',
        role: 'VOTER',
        isFacilitator: false,
        online: true,
        hat: null,
      },
    ],
    issues: [{ id: 'issue-1', title: 'Login', status: 'VOTING', finalEstimate: null }],
    currentRound: {
      id: 'round-1',
      issueId: 'issue-1',
      roundNumber: 1,
      status: 'OPEN',
      votes: [],
      result: null,
      previousRounds: [],
      dealerId: 'p1',
      timerDeadline: null,
    },
    ...overrides,
  };
}

describe('gameEventsReducer', () => {
  it('state_sync reemplaza el estado entero', () => {
    const next = baseState({ name: 'Otra partida' });
    expect(gameEventsReducer(null, { type: 'state_sync', version: 3, state: next })).toBe(next);
  });

  it('participant_joined no fabrica un participante: deja el estado igual (hace falta resync)', () => {
    const state = baseState();
    const event: ServerEvent = { type: 'participant_joined', version: 2, participantId: 'p3' };
    expect(gameEventsReducer(state, event)).toBe(state);
    expect(needsResync('participant_joined')).toBe(true);
  });

  it('participant_left no inventa el nuevo reparto de dealer: deja el estado igual (hace falta resync)', () => {
    const state = baseState();
    const event: ServerEvent = { type: 'participant_left', version: 2, participantId: 'p2' };
    expect(gameEventsReducer(state, event)).toBe(state);
    expect(needsResync('participant_left')).toBe(true);
  });

  it('issue_added no fabrica una issue: deja el estado igual (hace falta resync)', () => {
    const state = baseState();
    const event: ServerEvent = { type: 'issue_added', version: 2, issueId: 'issue-2' };
    expect(gameEventsReducer(state, event)).toBe(state);
    expect(needsResync('issue_added')).toBe(true);
  });

  it('round_started no fabrica una ronda: deja el estado igual (hace falta resync)', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'round_started',
      version: 2,
      roundId: 'round-2',
      issueId: 'issue-2',
    };
    expect(gameEventsReducer(state, event)).toBe(state);
    expect(needsResync('round_started')).toBe(true);
  });

  it('participant_role_changed actualiza el rol del participante', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'participant_role_changed',
      version: 2,
      participantId: 'p2',
      role: 'SPECTATOR',
    };
    const next = gameEventsReducer(state, event);
    expect(next?.participants.find((p) => p.id === 'p2')?.role).toBe('SPECTATOR');
  });

  it('participant_voted marca hasVoted sin exponer nunca la carta (invariante 7)', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'participant_voted',
      version: 2,
      roundId: 'round-1',
      participantId: 'p2',
    };
    const next = gameEventsReducer(state, event);
    const vote = next?.currentRound?.votes.find((v) => v.participantId === 'p2');
    expect(vote).toEqual({ participantId: 'p2', card: null, hasVoted: true });
  });

  it('vote_retracted quita al participante de los votos', () => {
    const state = baseState({
      currentRound: {
        id: 'round-1',
        issueId: 'issue-1',
        roundNumber: 1,
        status: 'OPEN',
        votes: [{ participantId: 'p1', card: null, hasVoted: true }],
        result: null,
        previousRounds: [],
        dealerId: 'p1',
        timerDeadline: null,
      },
    });
    const event: ServerEvent = {
      type: 'vote_retracted',
      version: 2,
      roundId: 'round-1',
      participantId: 'p1',
    };
    expect(gameEventsReducer(state, event)?.currentRound?.votes).toHaveLength(0);
  });

  it('round_revealed reemplaza los votos con los valores reales y el resultado', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'round_revealed',
      version: 3,
      roundId: 'round-1',
      votes: [
        { participantId: 'p1', card: '5' },
        { participantId: 'p2', card: '5' },
      ],
      result: {
        distribution: { '5': 2 },
        average: 5,
        agreementPercentage: 100,
        mostVoted: '5',
        isUnanimous: true,
      },
    };
    const next = gameEventsReducer(state, event);
    expect(next?.currentRound?.status).toBe('REVEALED');
    expect(next?.currentRound?.votes.map((v) => v.card)).toEqual(['5', '5']);
    expect(next?.currentRound?.result?.isUnanimous).toBe(true);
  });

  it('round_revealed conserva las rondas anteriores de la tarea para compararlas', () => {
    const previousRounds = [
      {
        id: 'round-0',
        roundNumber: 1,
        votes: [{ participantId: 'p1', card: '3' }],
        result: {
          distribution: { '3': 1 },
          average: 3,
          agreementPercentage: 100,
          mostVoted: '3',
          isUnanimous: true,
        },
      },
    ];
    const base = baseState();
    const state = base.currentRound
      ? { ...base, currentRound: { ...base.currentRound, roundNumber: 2, previousRounds } }
      : base;
    const event: ServerEvent = {
      type: 'round_revealed',
      version: 3,
      roundId: 'round-1',
      votes: [{ participantId: 'p1', card: '5' }],
      result: {
        distribution: { '5': 1 },
        average: 5,
        agreementPercentage: 100,
        mostVoted: '5',
        isUnanimous: true,
      },
    };

    expect(gameEventsReducer(state, event)?.currentRound?.previousRounds).toEqual(previousRounds);
  });

  it('issue_estimated marca la issue como estimada', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'issue_estimated',
      version: 4,
      issueId: 'issue-1',
      finalEstimate: '5',
    };
    const next = gameEventsReducer(state, event);
    expect(next?.issues[0]).toMatchObject({ status: 'ESTIMATED', finalEstimate: '5' });
  });

  it('participant_hat_changed cambia solo el sombrero de ese participante', () => {
    const event: ServerEvent = {
      type: 'participant_hat_changed',
      version: 2,
      participantId: 'p2',
      hat: 'wizard',
    };
    const next = gameEventsReducer(baseState(), event);
    expect(next?.participants.map((participant) => participant.hat)).toEqual([null, 'wizard']);
    expect(needsResync('participant_hat_changed')).toBe(false);
  });

  it('deck_changed reemplaza la baraja de la partida', () => {
    const event: ServerEvent = {
      type: 'deck_changed',
      version: 2,
      deck: { cards: ['XS', 'S', 'M', '?', '☕'] },
    };
    expect(gameEventsReducer(baseState(), event)?.deck.cards).toEqual(['XS', 'S', 'M', '?', '☕']);
  });

  it('settings_changed reemplaza los ajustes', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'settings_changed',
      version: 2,
      settings: { ...baseState().settings, countdownSeconds: 45 },
    };
    expect(gameEventsReducer(state, event)?.settings.countdownSeconds).toBe(45);
  });

  describe('gestión de tareas', () => {
    function withQueue(): GameView {
      return baseState({
        issues: [
          { id: 'issue-1', title: 'Login', status: 'VOTING', finalEstimate: null },
          { id: 'issue-2', title: 'Pagos', status: 'PENDING', finalEstimate: null },
          { id: 'issue-3', title: 'Informes', status: 'PENDING', finalEstimate: null },
        ],
      });
    }

    it('issue_edited sustituye solo esa tarea por la vista que trae el evento', () => {
      const event: ServerEvent = {
        type: 'issue_edited',
        version: 2,
        issue: {
          id: 'issue-2',
          title: 'Pagos con tarjeta',
          status: 'PENDING',
          finalEstimate: null,
        },
      };
      const next = gameEventsReducer(withQueue(), event);
      expect(next?.issues.map((issue) => issue.title)).toEqual([
        'Login',
        'Pagos con tarjeta',
        'Informes',
      ]);
      expect(needsResync('issue_edited')).toBe(false);
    });

    it('issue_removed quita la tarea y adopta el dealer que manda el servidor', () => {
      const event: ServerEvent = {
        type: 'issue_removed',
        version: 2,
        issueId: 'issue-2',
        dealerId: 'p2',
      };
      const next = gameEventsReducer(withQueue(), event);
      expect(next?.issues.map((issue) => issue.id)).toEqual(['issue-1', 'issue-3']);
      expect(next?.currentRound?.dealerId).toBe('p2');
      expect(needsResync('issue_removed')).toBe(false);
    });

    it('issues_reordered aplica el orden del evento y el dealer que manda el servidor', () => {
      const event: ServerEvent = {
        type: 'issues_reordered',
        version: 2,
        issueIds: ['issue-1', 'issue-3', 'issue-2'],
        dealerId: 'p2',
      };
      const next = gameEventsReducer(withQueue(), event);
      expect(next?.issues.map((issue) => issue.id)).toEqual(['issue-1', 'issue-3', 'issue-2']);
      expect(next?.currentRound?.dealerId).toBe('p2');
      expect(needsResync('issues_reordered')).toBe(false);
    });

    it('issues_reordered no pierde una tarea que el evento no nombra', () => {
      const event: ServerEvent = {
        type: 'issues_reordered',
        version: 2,
        issueIds: ['issue-3', 'issue-1'],
        dealerId: null,
      };
      const next = gameEventsReducer(withQueue(), event);
      expect(next?.issues.map((issue) => issue.id)).toEqual(['issue-3', 'issue-1', 'issue-2']);
    });

    it('sin ronda, borrar o reordenar no inventa una ronda para guardar el dealer', () => {
      const state = { ...withQueue(), currentRound: null };
      const event: ServerEvent = {
        type: 'issues_reordered',
        version: 2,
        issueIds: ['issue-3', 'issue-2', 'issue-1'],
        dealerId: null,
      };
      expect(gameEventsReducer(state, event)?.currentRound).toBeNull();
    });
  });

  it('ningún evento sobre estado null distinto de state_sync produce estado', () => {
    const event: ServerEvent = {
      type: 'participant_role_changed',
      version: 2,
      participantId: 'p1',
      role: 'SPECTATOR',
    };
    expect(gameEventsReducer(null, event)).toBeNull();
  });
});
