import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { SetFinalEstimate } from '../../src/application/use-cases/SetFinalEstimate.js';
import { StartVotingRound } from '../../src/application/use-cases/StartVotingRound.js';
import { toGameView } from '../../src/application/read-models/toGameView.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import { Game } from '../../src/domain/game/Game.js';
import { GameName } from '../../src/domain/game/GameName.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { Issue } from '../../src/domain/game/Issue.js';
import { Participant } from '../../src/domain/game/Participant.js';
import { Round } from '../../src/domain/game/Round.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';
import type { SeededOpenRound } from './support/gameFixtures.js';

interface Table {
  readonly seeded: SeededOpenRound;
  readonly graceId: string;
  vote: (participantId: string, card: string) => Promise<void>;
  reveal: () => Promise<void>;
  startRound: (issueId: string) => Promise<string>;
  addIssue: (title: string) => Promise<string>;
  estimate: (card: string) => Promise<void>;
  viewAs: (viewerId: string) => ReturnType<GetGameState['execute']>;
}

async function seedTable(): Promise<Table> {
  const seeded = await seedGameWithOpenRound();
  const { context, gameId } = seeded;
  const join = new JoinGame(context.games, context.events, context.clock, context.ids);
  const graceId = await join.execute({ gameId, displayName: 'Grace', role: 'VOTER' });
  const castVote = new CastVote(context.games, context.events, context.clock);
  const revealRound = new RevealRound(context.games, context.events, context.clock);
  const startVotingRound = new StartVotingRound(
    context.games,
    context.events,
    context.clock,
    context.ids,
  );
  const addIssue = new AddIssue(context.games, context.events, context.clock, context.ids);
  const setFinalEstimate = new SetFinalEstimate(context.games, context.events, context.clock);
  const getGameState = new GetGameState(context.games);

  return {
    seeded,
    graceId,
    vote: (participantId, card) => castVote.execute({ gameId, participantId, card }),
    reveal: () => revealRound.execute({ gameId, participantId: seeded.facilitatorId }),
    startRound: (issueId) => startVotingRound.execute({ gameId, issueId }),
    addIssue: (title) => addIssue.execute({ gameId, title }),
    estimate: (card) =>
      setFinalEstimate.execute({ gameId, participantId: seeded.facilitatorId, card }),
    viewAs: (viewerId) => getGameState.execute({ gameId, viewerId }),
  };
}

describe('previousRounds en la vista de la partida', () => {
  it('incluye la ronda anterior revelada de la misma tarea con sus votos y su resultado', async () => {
    const table = await seedTable();
    const { facilitatorId, issueId } = table.seeded;
    await table.vote(facilitatorId, '3');
    await table.vote(table.graceId, '8');
    await table.reveal();
    await table.startRound(issueId);

    const view = await table.viewAs(table.graceId);

    expect(view.currentRound?.roundNumber).toBe(2);
    expect(view.currentRound?.previousRounds).toEqual([
      {
        id: table.seeded.roundId,
        roundNumber: 1,
        votes: [
          { participantId: facilitatorId, card: '3' },
          { participantId: table.graceId, card: '8' },
        ],
        result: expect.objectContaining({ average: 5.5, isUnanimous: false }) as unknown,
      },
    ]);
  });

  it('no incluye en previousRounds una ronda abierta', async () => {
    const table = await seedTable();
    const { facilitatorId, issueId } = table.seeded;
    await table.vote(facilitatorId, '3');
    await table.vote(table.graceId, '8');
    await table.reveal();
    await table.startRound(issueId);
    await table.vote(table.graceId, '13');

    const view = await table.viewAs(facilitatorId);

    expect(view.currentRound?.status).toBe('OPEN');
    expect(view.currentRound?.previousRounds.map((round) => round.roundNumber)).toEqual([1]);
    expect(JSON.stringify(view)).not.toContain('"card":"13"');
  });

  it('previousRounds solo contiene rondas de la misma tarea', async () => {
    const table = await seedTable();
    const { facilitatorId, issueId } = table.seeded;
    await table.vote(facilitatorId, '3');
    await table.reveal();
    const otherIssueId = await table.addIssue('Implementar logout');
    await table.startRound(otherIssueId);
    await table.vote(facilitatorId, '5');
    await table.reveal();
    await table.startRound(issueId);

    const view = await table.viewAs(facilitatorId);

    expect(view.currentRound?.issueId).toBe(issueId);
    expect(view.currentRound?.previousRounds.map((round) => round.roundNumber)).toEqual([1]);
    expect(view.currentRound?.previousRounds.flatMap((round) => round.votes)).toEqual([
      { participantId: facilitatorId, card: '3' },
    ]);
  });

  it('pasar a la siguiente tarea no arrastra las rondas de la anterior', async () => {
    const table = await seedTable();
    const { facilitatorId, issueId } = table.seeded;
    await table.vote(facilitatorId, '3');
    await table.reveal();
    await table.startRound(issueId);
    await table.vote(facilitatorId, '5');
    await table.reveal();
    const nextIssueId = await table.addIssue('Implementar logout');
    await table.startRound(nextIssueId);

    const view = await table.viewAs(facilitatorId);

    expect(view.currentRound?.issueId).toBe(nextIssueId);
    expect(view.currentRound?.previousRounds).toEqual([]);
  });

  it('incluye en previousRounds una ronda ya cerrada por la estimación final', async () => {
    const table = await seedTable();
    const { facilitatorId, issueId } = table.seeded;
    await table.vote(facilitatorId, '3');
    await table.reveal();
    await table.estimate('3');
    await table.startRound(issueId);

    const view = await table.viewAs(facilitatorId);

    expect(view.currentRound?.previousRounds.map((round) => round.roundNumber)).toEqual([1]);
  });

  it('una ronda anterior que no está revelada no filtra sus votos (invariante 7)', () => {
    const facilitatorId = ParticipantId.of('participant-1');
    const graceId = ParticipantId.of('participant-2');
    const issueId = IssueId.of('issue-1');
    const game = Game.reconstitute({
      id: GameId.of('game-1'),
      name: GameName.of('Sprint 42'),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      participants: [
        Participant.join(facilitatorId, DisplayName.of('Ada'), 'VOTER', true, 0),
        Participant.join(graceId, DisplayName.of('Grace'), 'VOTER', false, 1),
      ],
      issues: [Issue.create(issueId, 'Implementar login')],
      rounds: [
        Round.reconstitute(
          RoundId.of('round-1'),
          issueId,
          1,
          'OPEN',
          [{ participantId: graceId, card: CardValue.of('21') }],
          null,
          null,
        ),
        Round.reconstitute(RoundId.of('round-2'), issueId, 2, 'OPEN', [], null, null),
      ],
    });

    const view = toGameView(game, facilitatorId);

    expect(view.currentRound?.previousRounds).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('"card":"21"');
  });
});
