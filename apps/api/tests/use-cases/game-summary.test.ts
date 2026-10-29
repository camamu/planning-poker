import { describe, expect, it } from 'vitest';
import { toGameSummaryView } from '../../src/application/read-models/toGameSummaryView.js';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GetGameSummary } from '../../src/application/use-cases/GetGameSummary.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { SetFinalEstimate } from '../../src/application/use-cases/SetFinalEstimate.js';
import { StartVotingRound } from '../../src/application/use-cases/StartVotingRound.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import { Game } from '../../src/domain/game/Game.js';
import { GameName } from '../../src/domain/game/GameName.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { Issue } from '../../src/domain/game/Issue.js';
import { Participant } from '../../src/domain/game/Participant.js';
import { Round } from '../../src/domain/game/Round.js';
import { seedGame } from './support/gameFixtures.js';
import { SteppingClock } from './support/SteppingClock.js';
import { NOW } from './support/context.js';

interface Table {
  readonly gameId: string;
  readonly facilitatorId: string;
  readonly graceId: string;
  readonly clock: SteppingClock;
  add: (title: string) => Promise<string>;
  /** Añade la tarea y abre su primera ronda. */
  open: (title: string) => Promise<string>;
  reopen: (issueId: string) => Promise<void>;
  vote: (participantId: string, card: string) => Promise<void>;
  reveal: () => Promise<void>;
  estimate: (card: string) => Promise<void>;
  summary: () => ReturnType<GetGameSummary['execute']>;
}

async function seedTable(deckId: string = SYSTEM_DECK_IDS.fibonacci.value): Promise<Table> {
  const seeded = await seedGame({ deckId });
  const { context, gameId, facilitatorId } = seeded;
  const clock = new SteppingClock(NOW);
  const join = new JoinGame(context.games, context.events, clock, context.ids);
  const graceId = await join.execute({ gameId, displayName: 'Grace', role: 'VOTER' });
  const addIssue = new AddIssue(context.games, context.events, clock, context.ids);
  const startRound = new StartVotingRound(context.games, context.events, clock, context.ids);
  const castVote = new CastVote(context.games, context.events, clock);
  const revealRound = new RevealRound(context.games, context.events, clock);
  const setFinalEstimate = new SetFinalEstimate(context.games, context.events, clock);
  const getGameSummary = new GetGameSummary(context.games);

  return {
    gameId,
    facilitatorId,
    graceId,
    clock,
    add: (title) => addIssue.execute({ gameId, title }),
    open: async (title) => {
      const issueId = await addIssue.execute({ gameId, title });
      await startRound.execute({ gameId, issueId });
      return issueId;
    },
    reopen: async (issueId) => {
      await startRound.execute({ gameId, issueId });
    },
    vote: (participantId, card) => castVote.execute({ gameId, participantId, card }),
    reveal: () => revealRound.execute({ gameId, participantId: facilitatorId }),
    estimate: (card) => setFinalEstimate.execute({ gameId, participantId: facilitatorId, card }),
    summary: () => getGameSummary.execute({ gameId }),
  };
}

/** Abre, vota (los dos igual), revela y estima: una tarea cerrada de principio a fin. */
async function estimateTask(table: Table, title: string, card: string): Promise<string> {
  const issueId = await table.open(title);
  await table.vote(table.facilitatorId, card);
  await table.vote(table.graceId, card);
  await table.reveal();
  await table.estimate(card);
  return issueId;
}

describe('resumen de la sesión', () => {
  it('la suma ignora estimaciones no numéricas', async () => {
    const table = await seedTable();
    await estimateTask(table, 'Login', '5');
    await estimateTask(table, 'Logout', '3');
    await estimateTask(table, 'Pagos', '?');
    await estimateTask(table, 'Descanso', '☕');

    const { totals } = await table.summary();

    expect(totals.points).toBe(8);
    expect(totals.nonNumericEstimates).toEqual({});
    expect(totals.estimatedCount).toBe(4);
  });

  it('con una baraja de tallas cuenta cada valor en vez de sumar', async () => {
    const table = await seedTable(SYSTEM_DECK_IDS.tshirt.value);
    await estimateTask(table, 'Login', 'M');
    await estimateTask(table, 'Logout', 'M');
    await estimateTask(table, 'Pagos', 'L');
    await estimateTask(table, 'Dudas', '?');

    const { totals } = await table.summary();

    expect(totals.points).toBeNull();
    expect(totals.nonNumericEstimates).toEqual({ M: 2, L: 1 });
  });

  it('una ronda abierta no cuenta en el resumen', async () => {
    const table = await seedTable();
    const issueId = await table.open('Login');
    await table.vote(table.facilitatorId, '3');
    await table.reveal();
    await table.reopen(issueId);
    await table.vote(table.graceId, '13');

    const summary = await table.summary();

    expect(summary.issues[0]).toMatchObject({
      status: 'VOTING',
      rounds: 1,
      agreementPercentage: 100,
      average: 3,
    });
    expect(summary.totals.voterCount).toBe(1);
    expect(JSON.stringify(summary)).not.toContain('"13"');
  });

  it('una tarea que nadie ha votado aparece pendiente, sin acuerdo ni media', async () => {
    const table = await seedTable();
    await estimateTask(table, 'Login', '3');
    const pendingId = await table.add('Pagos');

    const summary = await table.summary();

    expect(summary.totals.estimatedCount).toBe(1);
    expect(summary.totals.pendingCount).toBe(1);
    expect(summary.issues.find((issue) => issue.id === pendingId)).toMatchObject({
      status: 'PENDING',
      finalEstimate: null,
      rounds: 0,
      agreementPercentage: null,
      average: null,
      durationMs: null,
    });
  });

  it('el acuerdo y la media son los de la última ronda revelada', async () => {
    const table = await seedTable();
    const issueId = await table.open('Login');
    await table.vote(table.facilitatorId, '3');
    await table.vote(table.graceId, '8');
    await table.reveal();
    await table.reopen(issueId);
    await table.vote(table.facilitatorId, '5');
    await table.vote(table.graceId, '5');
    await table.reveal();
    await table.estimate('5');

    const [issue] = (await table.summary()).issues;

    expect(issue).toMatchObject({
      status: 'ESTIMATED',
      finalEstimate: '5',
      rounds: 2,
      agreementPercentage: 100,
      average: 5,
    });
  });

  it('cuenta las tareas con consenso total y las que necesitaron más de una ronda', async () => {
    const table = await seedTable();
    await estimateTask(table, 'Login', '3');
    const disputed = await table.open('Pagos');
    await table.vote(table.facilitatorId, '3');
    await table.vote(table.graceId, '13');
    await table.reveal();
    await table.reopen(disputed);
    await table.vote(table.facilitatorId, '8');
    await table.vote(table.graceId, '13');
    await table.reveal();
    await table.estimate('13');

    const { totals } = await table.summary();

    expect(totals.estimatedCount).toBe(2);
    expect(totals.unanimousCount).toBe(1);
    expect(totals.multiRoundCount).toBe(1);
    expect(totals.voterCount).toBe(2);
  });

  it('la duración va de abrir la primera ronda a la estimación final', async () => {
    const table = await seedTable();
    const issueId = await table.open('Login');
    table.clock.advanceSeconds(60);
    await table.vote(table.facilitatorId, '3');
    await table.reveal();
    await table.reopen(issueId);
    table.clock.advanceSeconds(120);
    await table.vote(table.facilitatorId, '3');
    await table.reveal();
    await table.estimate('3');
    await estimateTask(table, 'Logout', '2');

    const summary = await table.summary();

    expect(summary.issues[0]?.durationMs).toBe(180_000);
    expect(summary.issues[1]?.durationMs).toBe(0);
    expect(summary.totals.averageDurationMs).toBe(90_000);
  });

  it('la duración es nula si la ronda es anterior a la migración', () => {
    const facilitatorId = ParticipantId.of('participant-1');
    const issueId = IssueId.of('issue-1');
    const game = Game.reconstitute({
      id: GameId.of('game-1'),
      name: GameName.of('Sprint 42'),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      participants: [Participant.join(facilitatorId, DisplayName.of('Ada'), 'VOTER', true, 0)],
      issues: [
        Issue.reconstitute(
          issueId,
          'Implementar login',
          undefined,
          undefined,
          'ESTIMATED',
          CardValue.of('5'),
          null,
        ),
      ],
      rounds: [
        Round.reconstitute(
          RoundId.of('round-1'),
          issueId,
          1,
          'CLOSED',
          [{ participantId: facilitatorId, card: CardValue.of('5') }],
          NOW,
          null,
          null,
          'LIVE',
        ),
      ],
    });

    const summary = toGameSummaryView(game);

    expect(summary.issues[0]?.durationMs).toBeNull();
    expect(summary.totals.averageDurationMs).toBeNull();
    expect(summary.totals.points).toBe(5);
  });

  it('el resumen no contiene votos individuales', async () => {
    const table = await seedTable();
    await estimateTask(table, 'Login', '5');
    const issueId = await table.open('Pagos');
    await table.vote(table.facilitatorId, '3');
    await table.vote(table.graceId, '8');
    await table.reveal();
    await table.reopen(issueId);
    await table.vote(table.graceId, '13');

    const raw = JSON.stringify(await table.summary());

    expect(raw).not.toContain(table.facilitatorId);
    expect(raw).not.toContain(table.graceId);
    expect(raw).not.toContain('participantId');
    expect(raw).not.toContain('"votes"');
    expect(raw).not.toContain('"13"');
  });

  it('no existe el resumen de una partida desconocida', async () => {
    const { context } = await seedGame();
    const getGameSummary = new GetGameSummary(context.games);

    await expect(getGameSummary.execute({ gameId: 'no-existe' })).rejects.toThrow(
      GameNotFoundError,
    );
  });
});
