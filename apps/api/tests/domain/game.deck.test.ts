import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import { CardNotInDeckError, DeckChangeDuringVotingError } from '../../src/domain/game/Game.js';
import { ParticipantId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

describe('Game.changeDeck', () => {
  it('el facilitador puede cambiar la baraja y las cartas nuevas pasan a ser las votables', () => {
    const { game, facilitatorId } = createGame();

    game.changeDeck(Deck.tshirt(), facilitatorId, NOW);
    addIssueAndOpenRound(game);

    expect(() => {
      game.castVote(facilitatorId, CardValue.of('XL'), NOW);
    }).not.toThrow();
    expect(() => {
      game.castVote(facilitatorId, CardValue.of('5'), NOW);
    }).toThrow(CardNotInDeckError);
  });

  it('permite a cualquier votante, no solo al facilitador, cambiar la baraja', () => {
    const { game } = createGame();
    const voterId = addVoter(game);

    game.changeDeck(Deck.tshirt(), voterId, NOW);

    expect(game.currentDeck().contains(CardValue.of('XL'))).toBe(true);
  });

  it('permite a un espectador cambiar la baraja', () => {
    const { game } = createGame();
    const spectatorId = ParticipantId.of('spectator-1');
    game.addParticipant(spectatorId, DisplayName.of('Mirón'), 'SPECTATOR', NOW);

    game.changeDeck(Deck.tshirt(), spectatorId, NOW);

    expect(game.currentDeck().contains(CardValue.of('XL'))).toBe(true);
  });

  it('no permite cambiar la baraja con una ronda abierta', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);

    expect(() => {
      game.changeDeck(Deck.tshirt(), facilitatorId, NOW);
    }).toThrow(DeckChangeDuringVotingError);
  });

  it('permite cambiar la baraja una vez revelada la ronda', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    game.changeDeck(Deck.tshirt(), facilitatorId, NOW);

    expect(game.currentDeck().contains(CardValue.of('XL'))).toBe(true);
    expect(game.currentRound()?.revealedResult().mostVoted?.raw).toBe('5');
  });

  it('emite GameDeckChanged', () => {
    const { game, facilitatorId } = createGame();
    game.pullDomainEvents();

    game.changeDeck(Deck.tshirt(), facilitatorId, NOW);

    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['GameDeckChanged']);
  });
});
