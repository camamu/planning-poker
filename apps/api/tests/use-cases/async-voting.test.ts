import { describe, expect, it } from 'vitest';
import type { PresenceReader } from '../../src/application/ports/PresenceReader.js';
import { toGameSummaryView } from '../../src/application/read-models/toGameSummaryView.js';
import { toGameView } from '../../src/application/read-models/toGameView.js';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { CastAsyncVote } from '../../src/application/use-cases/CastAsyncVote.js';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { OpenAsyncRounds } from '../../src/application/use-cases/OpenAsyncRounds.js';
import { RevealAsyncRounds } from '../../src/application/use-cases/RevealAsyncRounds.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { SetFinalEstimate } from '../../src/application/use-cases/SetFinalEstimate.js';
import { StartVotingRound } from '../../src/application/use-cases/StartVotingRound.js';
import { IssueNotPendingError } from '../../src/domain/game/Game.js';
import type { Game } from '../../src/domain/game/Game.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';
import { SteppingClock } from './support/SteppingClock.js';
import { NOW } from './support/context.js';
import type { UseCaseContext } from './support/context.js';

interface AsyncTable {
  readonly context: UseCaseContext;
  readonly gameId: string;
  readonly facilitatorId: string;
  readonly graceId: string;
  readonly clock: SteppingClock;
  load: () => Promise<Game>;
  issue: (title: string) => Promise<string>;
  open: (participantId: string, ...issueIds: string[]) => Promise<void>;
  vote: (participantId: string, issueId: string, card: string) => Promise<void>;
  reveal: (participantId: string, issueIds?: string[]) => Promise<void>;
  estimate: (participantId: string, card: string, issueId?: string) => Promise<void>;
  startLive: (issueId: string, presence?: PresenceReader) => Promise<string>;
  liveVote: (participantId: string, card: string) => Promise<void>;
  liveReveal: (participantId: string) => Promise<void>;
}

async function seedAsyncTable(overrides: Parameters<typeof seedGame>[0] = {}): Promise<AsyncTable> {
  const seeded = await seedGame(overrides);
  const { context, gameId, facilitatorId } = seeded;
  const clock = new SteppingClock(NOW);
  const join = new JoinGame(context.games, context.events, clock, context.ids);
  const graceId = await join.execute({ gameId, displayName: 'Grace', role: 'VOTER' });
  const addIssue = new AddIssue(context.games, context.events, clock, context.ids);
  const openAsync = new OpenAsyncRounds(context.games, context.events, clock, context.ids);
  const castAsync = new CastAsyncVote(context.games, context.events, clock);
  const revealAsync = new RevealAsyncRounds(context.games, context.events, clock);
  const setEstimate = new SetFinalEstimate(context.games, context.events, clock);
  const castVote = new CastVote(context.games, context.events, clock);
  const revealRound = new RevealRound(context.games, context.events, clock);
  const startRound = (presence?: PresenceReader): StartVotingRound =>
    new StartVotingRound(context.games, context.events, clock, context.ids, presence);

  const load = async (): Promise<Game> => {
    const game = await context.games.findById(GameId.of(gameId));
    if (!game) throw new Error('la partida no existe');
    return game;
  };
  const issue = (title: string): Promise<string> => addIssue.execute({ gameId, title });
  context.events.clear();

  return {
    context,
    gameId,
    facilitatorId,
    graceId,
    clock,
    load,
    issue,
    open: (participantId: string, ...issueIds: string[]) =>
      openAsync.execute({ gameId, participantId, issueIds }),
    vote: (participantId: string, issueId: string, card: string) =>
      castAsync.execute({ gameId, participantId, issueId, card }),
    reveal: (participantId: string, issueIds?: string[]) =>
      revealAsync.execute({ gameId, participantId, issueIds }),
    estimate: (participantId: string, card: string, issueId?: string) =>
      setEstimate.execute({ gameId, participantId, card, issueId }),
    startLive: (issueId: string, presence?: PresenceReader) =>
      startRound(presence).execute({ gameId, issueId }),
    liveVote: (participantId: string, card: string) =>
      castVote.execute({ gameId, participantId, card }),
    liveReveal: (participantId: string) => revealRound.execute({ gameId, participantId }),
  };
}

describe('OpenAsyncRounds', () => {
  it('abre las tareas indicadas en diferido y publica un único AsyncRoundsOpened', async () => {
    const table = await seedAsyncTable();
    const first = await table.issue('Login');
    const second = await table.issue('Pagos');
    table.context.events.clear();

    await table.open(table.facilitatorId, first, second);

    const game = await table.load();
    expect(game.activeAsyncRounds()).toHaveLength(2);
    expect(table.context.events.published.map((event) => event.type)).toEqual([
      'AsyncRoundsOpened',
    ]);
  });

  it('rechaza una tarea que no está pendiente', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.startLive(issueId);

    await expect(table.open(table.facilitatorId, issueId)).rejects.toBeInstanceOf(
      IssueNotPendingError,
    );
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const table = await seedAsyncTable();
    const useCase = new OpenAsyncRounds(
      table.context.games,
      table.context.events,
      table.context.clock,
      table.context.ids,
    );

    await expect(
      useCase.execute({
        gameId: 'inexistente',
        participantId: table.facilitatorId,
        issueIds: ['x'],
      }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });
});

describe('CastAsyncVote y RevealAsyncRounds', () => {
  it('registra el voto y publica AsyncVoteCast sin la carta', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    table.context.events.clear();

    await table.vote(table.graceId, issueId, '8');

    const [event] = table.context.events.published;
    expect(event?.type).toBe('AsyncVoteCast');
    expect(JSON.stringify(event)).not.toContain('"8"');
  });

  it('revela todas las rondas con votos y publica AsyncRoundsRevealed', async () => {
    const table = await seedAsyncTable();
    const voted = await table.issue('Login');
    const empty = await table.issue('Pagos');
    await table.open(table.facilitatorId, voted, empty);
    await table.vote(table.graceId, voted, '5');
    table.context.events.clear();

    await table.reveal(table.facilitatorId);

    const game = await table.load();
    expect(game.activeAsyncRounds().map((round) => round.currentStatus())).toEqual([
      'REVEALED',
      'OPEN',
    ]);
    expect(table.context.events.published.map((event) => event.type)).toEqual([
      'AsyncRoundsRevealed',
    ]);
  });

  it('revela solo las tareas indicadas', async () => {
    const table = await seedAsyncTable();
    const first = await table.issue('Login');
    const second = await table.issue('Pagos');
    await table.open(table.facilitatorId, first, second);
    await table.vote(table.graceId, first, '5');
    await table.vote(table.graceId, second, '5');

    await table.reveal(table.facilitatorId, [second]);

    const game = await table.load();
    expect(game.activeAsyncRounds().map((round) => round.currentStatus())).toEqual([
      'OPEN',
      'REVEALED',
    ]);
  });

  it('estima una tarea revelada en diferido sin pasarla por la mesa', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '5');
    await table.reveal(table.facilitatorId);
    table.context.events.clear();

    await table.estimate(table.facilitatorId, '5', issueId);

    const game = await table.load();
    expect(game.currentRound()).toBeUndefined();
    expect(game.allIssues()[0]?.currentFinalEstimate()?.raw).toBe('5');
    expect(table.context.events.published.map((event) => event.type)).toEqual(['IssueEstimated']);
  });
});

describe('pasar a la mesa una tarea con votos en diferido', () => {
  it('conserva los votos y no deja ninguna ronda asíncrona abierta', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '5');

    await table.startLive(issueId);

    const game = await table.load();
    expect(game.currentRound()?.hasVoted(ParticipantId.of(table.graceId))).toBe(true);
    expect(game.activeAsyncRounds()).toEqual([]);
  });

  it('con auto-revelado revela al instante cuando votaron todos los que están presentes', async () => {
    const table = await seedAsyncTable({ autoReveal: true });
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.facilitatorId, issueId, '5');
    const onlyFacilitator: PresenceReader = {
      onlineParticipants: () => [],
      votingPresence: () => [ParticipantId.of(table.facilitatorId)],
    };

    await table.startLive(issueId, onlyFacilitator);

    const game = await table.load();
    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('sin presencia conocida cuenta a todos y no revela si falta alguien', async () => {
    const table = await seedAsyncTable({ autoReveal: true });
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.facilitatorId, issueId, '5');

    await table.startLive(issueId);

    const game = await table.load();
    expect(game.currentRound()?.isOpen()).toBe(true);
  });
});

describe('toGameView con rondas en diferido', () => {
  it('una ronda abierta solo dice quién ha votado: la carta de otro no sale en la vista', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.facilitatorId, issueId, '13');
    await table.vote(table.graceId, issueId, '8');
    const game = await table.load();

    const graceView = toGameView(game, ParticipantId.of(table.graceId));

    const [round] = graceView.asyncRounds;
    expect(round?.voterIds).toEqual([table.facilitatorId, table.graceId]);
    expect(round?.ownCard).toBe('8');
    expect(round?.votes).toEqual([]);
    expect(round?.result).toBeNull();
    // La baraja también lleva un «13»: lo que no debe contenerlo es lo que cuelga de las rondas.
    expect(JSON.stringify(graceView.asyncRounds)).not.toContain('13');
  });

  it('quien no ha votado no ve ninguna carta, ni siquiera la suya', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.facilitatorId, issueId, '13');
    const game = await table.load();

    const graceView = toGameView(game, ParticipantId.of(table.graceId));

    expect(graceView.asyncRounds[0]?.ownCard).toBeNull();
    expect(JSON.stringify(graceView.asyncRounds)).not.toContain('13');
  });

  it('tras revelar, todos ven los votos y el resultado', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.facilitatorId, issueId, '13');
    await table.vote(table.graceId, issueId, '8');
    await table.reveal(table.facilitatorId);
    const game = await table.load();

    const graceView = toGameView(game, ParticipantId.of(table.graceId));

    const [round] = graceView.asyncRounds;
    expect(round?.status).toBe('REVEALED');
    expect(round?.votes).toEqual([
      { participantId: table.facilitatorId, card: '13' },
      { participantId: table.graceId, card: '8' },
    ]);
    expect(round?.result?.distribution).toEqual({ '13': 1, '8': 1 });
  });

  it('las rondas en diferido no son la ronda actual de la vista', async () => {
    const table = await seedAsyncTable();
    await table.open(table.facilitatorId, await table.issue('Login'));
    const game = await table.load();

    const view = toGameView(game, ParticipantId.of(table.facilitatorId));

    expect(view.currentRound).toBeNull();
    expect(view.asyncRounds).toHaveLength(1);
  });

  it('deja de listar la ronda cuando la tarea se estima o se lleva a la mesa', async () => {
    const table = await seedAsyncTable();
    const estimated = await table.issue('Login');
    const onTable = await table.issue('Pagos');
    await table.open(table.facilitatorId, estimated, onTable);
    await table.vote(table.graceId, estimated, '5');
    await table.reveal(table.facilitatorId);

    await table.estimate(table.facilitatorId, '5', estimated);
    await table.startLive(onTable);

    const game = await table.load();
    expect(toGameView(game, ParticipantId.of(table.facilitatorId)).asyncRounds).toEqual([]);
  });

  it('una ronda en diferido revelada aparece como ronda anterior al volver a votar en vivo', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '8');
    await table.reveal(table.facilitatorId);

    await table.startLive(issueId);

    const view = toGameView(await table.load(), ParticipantId.of(table.facilitatorId));
    expect(view.currentRound?.roundNumber).toBe(2);
    expect(view.currentRound?.previousRounds.map((round) => round.roundNumber)).toEqual([1]);
    expect(view.currentRound?.previousRounds[0]?.votes).toEqual([
      { participantId: table.graceId, card: '8' },
    ]);
  });
});

describe('resumen de sesión con rondas en diferido', () => {
  it('la duración cuenta desde la primera ronda en vivo y no desde la apertura en diferido', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '5');
    table.clock.advanceSeconds(3 * 24 * 3600);
    await table.reveal(table.facilitatorId);
    await table.startLive(issueId);
    table.clock.advanceSeconds(90);
    await table.liveVote(table.facilitatorId, '5');
    await table.liveReveal(table.facilitatorId);
    await table.estimate(table.facilitatorId, '5');

    const summary = toGameSummaryView(await table.load());

    expect(summary.issues[0]?.durationMs).toBe(90_000);
    expect(summary.issues[0]?.rounds).toBe(2);
  });

  it('una tarea que solo se votó en diferido no tiene duración', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '5');
    table.clock.advanceSeconds(3600);
    await table.reveal(table.facilitatorId);
    await table.estimate(table.facilitatorId, '5', issueId);

    const summary = toGameSummaryView(await table.load());

    expect(summary.issues[0]?.durationMs).toBeNull();
    expect(summary.totals.averageDurationMs).toBeNull();
    expect(summary.totals.points).toBe(5);
    expect(summary.issues[0]?.rounds).toBe(1);
  });

  it('una ronda en diferido abierta no cuenta en el resumen', async () => {
    const table = await seedAsyncTable();
    const issueId = await table.issue('Login');
    await table.open(table.facilitatorId, issueId);
    await table.vote(table.graceId, issueId, '5');

    const summary = toGameSummaryView(await table.load());

    expect(summary.issues[0]?.rounds).toBe(0);
    expect(summary.issues[0]?.agreementPercentage).toBeNull();
    expect(summary.totals.voterCount).toBe(0);
  });
});
