import { describe, expect, it } from 'vitest';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DeckName } from '../../src/domain/deck/DeckName.js';
import { DeckId } from '../../src/domain/deck/DeckId.js';
import {
  DeckNotAvailableError,
  DeckNotOwnedByTeamError,
  SavedDeck,
  SYSTEM_DECKS,
} from '../../src/domain/deck/SavedDeck.js';
import { TeamId } from '../../src/domain/team/TeamId.js';

describe('SavedDeck.createCustom', () => {
  it('crea una baraja personalizada marcada como isCustom() y con "?"/"☕" añadidas', () => {
    const deck = SavedDeck.createCustom({
      id: DeckId.of('deck-1'),
      teamId: TeamId.of('team-1'),
      name: DeckName.of('Mi baraja'),
      rawCards: ['1', '2', '3'],
    });

    expect(deck.isCustom()).toBe(true);
    expect(
      deck
        .currentDeck()
        .values()
        .map((card) => card.raw),
    ).toEqual(['1', '2', '3', '?', '☕']);
  });
});

describe('SavedDeck.belongsTo / assertOwnedBy', () => {
  it('una baraja de sistema (teamId null) no pertenece a ningún equipo', () => {
    const deck = SavedDeck.reconstitute({
      id: DeckId.of('deck-system'),
      teamId: null,
      name: DeckName.of('Fibonacci'),
      deck: Deck.fibonacci(),
    });

    expect(deck.belongsTo(TeamId.of('team-1'))).toBe(false);
    expect(() => {
      deck.assertOwnedBy(TeamId.of('team-1'));
    }).toThrow(DeckNotOwnedByTeamError);
  });

  it('assertOwnedBy no lanza cuando el equipo coincide', () => {
    const teamId = TeamId.of('team-1');
    const deck = SavedDeck.createCustom({
      id: DeckId.of('deck-1'),
      teamId,
      name: DeckName.of('Mi baraja'),
      rawCards: ['1', '2'],
    });

    expect(() => {
      deck.assertOwnedBy(teamId);
    }).not.toThrow();
  });

  it('assertOwnedBy lanza cuando la baraja es de otro equipo', () => {
    const deck = SavedDeck.createCustom({
      id: DeckId.of('deck-1'),
      teamId: TeamId.of('team-1'),
      name: DeckName.of('Mi baraja'),
      rawCards: ['1', '2'],
    });

    expect(() => {
      deck.assertOwnedBy(TeamId.of('team-2'));
    }).toThrow(DeckNotOwnedByTeamError);
  });
});

describe('SavedDeck.assertAvailableTo', () => {
  const custom = SavedDeck.createCustom({
    id: DeckId.of('deck-1'),
    teamId: TeamId.of('team-1'),
    name: DeckName.of('Mi baraja'),
    rawCards: ['1', '2'],
  });

  it('una baraja de sistema está disponible para partidas con y sin equipo', () => {
    const [system] = SYSTEM_DECKS;

    expect(() => {
      system?.assertAvailableTo(null);
      system?.assertAvailableTo(TeamId.of('team-1'));
    }).not.toThrow();
  });

  it('una baraja personalizada solo está disponible para su equipo', () => {
    expect(() => {
      custom.assertAvailableTo(TeamId.of('team-1'));
    }).not.toThrow();
    expect(() => {
      custom.assertAvailableTo(TeamId.of('team-2'));
    }).toThrow(DeckNotAvailableError);
    expect(() => {
      custom.assertAvailableTo(null);
    }).toThrow(DeckNotAvailableError);
  });
});
