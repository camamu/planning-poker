import { describe, expect, it } from 'vitest';
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

const NOW = new Date('2026-08-07T10:00:00Z');

function reconstitutedGame(): Game {
  const facilitatorId = ParticipantId.of('participant-1');
  const issueId = IssueId.of('issue-1');
  const roundId = RoundId.of('round-1');

  return Game.reconstitute({
    id: GameId.of('game-1'),
    name: GameName.of('Sprint 42'),
    deck: Deck.fibonacci(),
    settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
    participants: [Participant.join(facilitatorId, DisplayName.of('Ada'), 'VOTER', true, 0)],
    issues: [Issue.create(issueId, 'Implementar login')],
    rounds: [
      Round.reconstitute(
        roundId,
        issueId,
        1,
        'OPEN',
        [{ participantId: facilitatorId, card: CardValue.of('5') }],
        null,
        null,
      ),
    ],
  });
}

describe('Game.reconstitute', () => {
  it('no registra ningún evento de dominio', () => {
    const game = reconstitutedGame();
    expect(game.pullDomainEvents()).toHaveLength(0);
  });

  it('reconstruye participantes, issues y rondas tal cual se le pasan', () => {
    const game = reconstitutedGame();

    expect(game.allParticipants()).toHaveLength(1);
    expect(game.allIssues()).toHaveLength(1);
    expect(game.allRounds()).toHaveLength(1);
    expect(game.currentRound()?.id.equals(RoundId.of('round-1'))).toBe(true);
    expect(game.findIssue(IssueId.of('issue-1'))).toBeDefined();
  });

  it('conserva el nombre, la baraja y los ajustes originales', () => {
    const game = reconstitutedGame();

    expect(game.currentName().value).toBe('Sprint 42');
    expect(game.currentDeck().contains(CardValue.of('5'))).toBe(true);
    expect(game.currentSettings().whoCanReveal).toBe('FACILITATOR_ONLY');
  });

  it('una ronda reconstituida como OPEN sigue aceptando business methods después', () => {
    const game = reconstitutedGame();
    const facilitatorId = ParticipantId.of('participant-1');

    game.reveal(facilitatorId, NOW);

    expect(game.currentRound()?.isRevealed()).toBe(true);
    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['RoundRevealed']);
  });

  it('el dealer se calcula con el joinOrder reconstituido, no con el orden de llegada de las filas', () => {
    const facilitatorId = ParticipantId.of('participant-1');
    const secondVoterId = ParticipantId.of('participant-2');
    const issueId = IssueId.of('issue-1');
    const roundId = RoundId.of('round-1');

    // Filas "de BD" a propósito en orden inverso al joinOrder: si el cálculo confiara en el
    // orden del array en vez del campo, el dealer saldría mal.
    const game = Game.reconstitute({
      id: GameId.of('game-1'),
      name: GameName.of('Sprint 42'),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'DEALER' }),
      participants: [
        Participant.join(secondVoterId, DisplayName.of('Grace'), 'VOTER', false, 1),
        Participant.join(facilitatorId, DisplayName.of('Ada'), 'VOTER', true, 0),
      ],
      issues: [Issue.create(issueId, 'Implementar login')],
      rounds: [Round.reconstitute(roundId, issueId, 1, 'OPEN', [], null, null)],
    });

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });
});
