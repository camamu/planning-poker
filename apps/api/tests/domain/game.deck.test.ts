import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import {
  CardNotInDeckError,
  DeckChangeDuringVotingError,
  DeckChangeNotAllowedError,
} from '../../src/domain/game/Game.js';
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

  it('no permite a un participante que no es facilitador cambiar la baraja', () => {
    const { game } = createGame();
    const voterId = addVoter(game);

    expect(() => {
      game.changeDeck(Deck.tshirt(), voterId, NOW);
    }).toThrow(DeckChangeNotAllowedError);
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
