import { describe, expect, it } from 'vitest';
import { ChangeGameDeck } from '../../src/application/use-cases/ChangeGameDeck.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { DeckNotFoundError } from '../../src/application/use-cases/DeckNotFoundError.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { ListGameDecks } from '../../src/application/use-cases/ListGameDecks.js';
import { SaveCustomDeck } from '../../src/application/use-cases/SaveCustomDeck.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { DeckNotAvailableError, SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import {
  DeckChangeDuringVotingError,
  DeckChangeNotAllowedError,
} from '../../src/domain/game/Game.js';
import { GameId } from '../../src/domain/game/ids.js';
import { seedGame, seedGameWithOpenRound } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

function changeDeckUseCase(seeded: SeededGame): ChangeGameDeck {
  const { games, decks, events, clock } = seeded.context;
  return new ChangeGameDeck(games, decks, events, clock);
}

describe('ChangeGameDeck', () => {
  it('el facilitador cambia la baraja y queda guardada en la partida', async () => {
    const seeded = await seedGame();

    await changeDeckUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      deckId: SYSTEM_DECK_IDS.tshirt.value,
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentDeck().contains(CardValue.of('XL'))).toBe(true);
  });

  it('publica GameDeckChanged', async () => {
    const seeded = await seedGame();

    await changeDeckUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      deckId: SYSTEM_DECK_IDS.tshirt.value,
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['GameDeckChanged']);
  });

  it('lanza DeckChangeNotAllowedError si quien lo pide no es el facilitador', async () => {
    const seeded = await seedGame();
    const { games, events, clock, ids } = seeded.context;
    const voterId = await new JoinGame(games, events, clock, ids).execute({
      gameId: seeded.gameId,
      displayName: 'Grace',
      role: 'VOTER',
    });

    await expect(
      changeDeckUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: voterId,
        deckId: SYSTEM_DECK_IDS.tshirt.value,
      }),
    ).rejects.toThrow(DeckChangeNotAllowedError);
  });

  it('lanza DeckChangeDuringVotingError con una ronda abierta', async () => {
    const seeded = await seedGameWithOpenRound();

    await expect(
      changeDeckUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        deckId: SYSTEM_DECK_IDS.tshirt.value,
      }),
    ).rejects.toThrow(DeckChangeDuringVotingError);
  });

  it('lanza DeckNotFoundError si la baraja no existe', async () => {
    const seeded = await seedGame();

    await expect(
      changeDeckUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        deckId: 'no-existe',
      }),
    ).rejects.toThrow(DeckNotFoundError);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();

    await expect(
      changeDeckUseCase(seeded).execute({
        gameId: 'no-existe',
        participantId: seeded.facilitatorId,
        deckId: SYSTEM_DECK_IDS.tshirt.value,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });

  it('no permite usar la baraja personalizada de un equipo ajeno', async () => {
    const seeded = await seedGame();
    const { teams, decks, hasher, ids } = seeded.context;
    const team = await new CreateTeam(teams, hasher, ids).execute({ name: 'Otro equipo' });
    const { deckId } = await new SaveCustomDeck(decks, teams, hasher, ids).execute({
      teamSlug: team.slug,
      token: team.token,
      name: 'Ajena',
      cards: ['1', '2'],
    });

    await expect(
      changeDeckUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        deckId,
      }),
    ).rejects.toThrow(DeckNotAvailableError);
  });
});

describe('ListGameDecks', () => {
  it('una partida sin equipo solo ofrece las barajas de sistema', async () => {
    const seeded = await seedGame();
    const { games, decks } = seeded.context;

    const available = await new ListGameDecks(games, decks).execute({ gameId: seeded.gameId });

    expect(available.map((deck) => deck.name).sort()).toEqual(['Fibonacci', 'Tallas']);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const { games, decks } = seeded.context;

    await expect(new ListGameDecks(games, decks).execute({ gameId: 'no-existe' })).rejects.toThrow(
      GameNotFoundError,
    );
  });
});
