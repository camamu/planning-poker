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
      { id: 'p1', displayName: 'Ada', role: 'VOTER', isFacilitator: true },
      { id: 'p2', displayName: 'Grace', role: 'VOTER', isFacilitator: false },
    ],
    issues: [{ id: 'issue-1', title: 'Login', status: 'VOTING', finalEstimate: null }],
    currentRound: {
      id: 'round-1',
      issueId: 'issue-1',
      roundNumber: 1,
      status: 'OPEN',
      votes: [],
      result: null,
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

  it('settings_changed reemplaza los ajustes', () => {
    const state = baseState();
    const event: ServerEvent = {
      type: 'settings_changed',
      version: 2,
      settings: { ...baseState().settings, countdownSeconds: 45 },
    };
    expect(gameEventsReducer(state, event)?.settings.countdownSeconds).toBe(45);
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
