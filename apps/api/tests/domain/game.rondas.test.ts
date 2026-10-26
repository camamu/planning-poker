import { describe, expect, it } from 'vitest';
import { IssueId, RoundId } from '../../src/domain/game/ids.js';
import { NOW, addIssueAndOpenRound, addVoter, createGame, nextId } from './support/gameFixtures.js';

function openRound(game: ReturnType<typeof createGame>['game'], issueId: IssueId): RoundId {
  const roundId = RoundId.of(nextId('round'));
  game.startVotingRound(roundId, issueId, NOW);
  return roundId;
}

describe('rondas de una tarea', () => {
  it('devuelve las rondas de la tarea en el orden en que se abrieron', () => {
    const { game, facilitatorId } = createGame();
    addVoter(game);
    const { issueId, roundId: first } = addIssueAndOpenRound(game);
    game.reveal(facilitatorId, NOW);
    const second = openRound(game, issueId);

    const rounds = game.roundsOf(issueId);

    expect(rounds.map((round) => round.id.value)).toEqual([first.value, second.value]);
    expect(rounds.map((round) => round.roundNumber)).toEqual([1, 2]);
  });

  it('no mezcla las rondas de otra tarea', () => {
    const { game, facilitatorId } = createGame();
    const { issueId: firstIssue, roundId: firstRound } = addIssueAndOpenRound(game);
    game.reveal(facilitatorId, NOW);
    const { issueId: secondIssue, roundId: secondRound } = addIssueAndOpenRound(game);

    expect(game.roundsOf(firstIssue).map((round) => round.id.value)).toEqual([firstRound.value]);
    expect(game.roundsOf(secondIssue).map((round) => round.id.value)).toEqual([secondRound.value]);
  });

  it('devuelve una lista vacía para una tarea que nunca se ha votado', () => {
    const { game } = createGame();
    const issueId = IssueId.of(nextId('issue'));
    game.addIssue(issueId, 'Sin votar', NOW);

    expect(game.roundsOf(issueId)).toEqual([]);
  });
});
