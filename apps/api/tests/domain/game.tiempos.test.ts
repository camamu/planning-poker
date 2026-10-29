import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { RoundId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, createGame, nextId, NOW } from './support/gameFixtures.js';

const LATER = new Date(NOW.getTime() + 90_000);

describe('tiempos de ronda y de tarea', () => {
  it('una ronda nueva guarda cuándo se abrió', () => {
    const { game } = createGame();

    addIssueAndOpenRound(game);

    expect(game.currentRound()?.currentOpenedAt()).toEqual(NOW);
  });

  it('cada ronda de una misma tarea guarda su propia hora de apertura', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.reveal(facilitatorId, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, LATER);

    expect(game.roundsOf(issueId).map((round) => round.currentOpenedAt())).toEqual([NOW, LATER]);
  });

  it('estimar una tarea guarda cuándo se estimó', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    game.setFinalEstimate(CardValue.of('5'), facilitatorId, LATER);

    expect(game.findIssue(issueId)?.currentEstimatedAt()).toEqual(LATER);
  });

  it('una tarea sin estimar no tiene fecha de estimación', () => {
    const { game } = createGame();
    const { issueId } = addIssueAndOpenRound(game);

    expect(game.findIssue(issueId)?.currentEstimatedAt()).toBeNull();
  });
});
