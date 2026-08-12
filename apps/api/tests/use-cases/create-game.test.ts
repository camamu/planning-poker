import { describe, expect, it } from 'vitest';
import { CreateGame } from '../../src/application/use-cases/CreateGame.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { CardNotInDeckError, NoOpenRoundError } from '../../src/domain/game/Game.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { makeContext } from './support/context.js';

describe('CreateGame', () => {
  it('crea la partida y la persiste en el repositorio', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    const { gameId } = await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
      facilitatorName: 'Ada',
    });

    const stored = await ctx.games.findById(GameId.of(gameId));
    expect(stored?.currentName().value).toBe('Sprint 42');
  });

  it('registra al facilitador con permiso para revelar bajo FACILITATOR_ONLY', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    const { gameId, facilitatorId } = await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
      facilitatorName: 'Ada',
    });

    const stored = await ctx.games.findById(GameId.of(gameId));
    expect(stored?.canReveal(ParticipantId.of(facilitatorId))).toBe(true);
  });

  it('usa la baraja de tallas cuando se elige ese deckId', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    const { gameId, facilitatorId } = await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.tshirt.value,
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
      facilitatorName: 'Ada',
    });

    const stored = await ctx.games.findById(GameId.of(gameId));
    // 'M' pertenece a Deck.tshirt(): si la baraja fuese fibonacci, castVote lanzaría CardNotInDeckError
    // antes de llegar a comprobar que no hay ronda abierta.
    expect(() => {
      stored?.castVote(ParticipantId.of(facilitatorId), CardValue.of('M'), ctx.clock.now());
    }).toThrow(NoOpenRoundError);
  });

  it('la baraja de tallas rechaza cartas de fibonacci', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    const { gameId, facilitatorId } = await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.tshirt.value,
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
      facilitatorName: 'Ada',
    });

    const stored = await ctx.games.findById(GameId.of(gameId));
    expect(() => {
      stored?.castVote(ParticipantId.of(facilitatorId), CardValue.of('13'), ctx.clock.now());
    }).toThrow(CardNotInDeckError);
  });

  it('mapea namedRevealers a ParticipantId al construir la partida', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    // SequentialIdGenerator es determinista: CreateGame pide el id del facilitador antes que
    // el de la partida, así que el primer id generado ('id-1') será el del facilitador.
    const predictedFacilitatorId = 'id-1';

    const { gameId, facilitatorId } = await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      settings: {
        autoReveal: false,
        whoCanReveal: 'NAMED_LIST',
        namedRevealers: [predictedFacilitatorId],
      },
      facilitatorName: 'Ada',
    });

    expect(facilitatorId).toBe(predictedFacilitatorId);
    const stored = await ctx.games.findById(GameId.of(gameId));
    expect(stored?.canReveal(ParticipantId.of(facilitatorId))).toBe(true);
  });

  it('publica GameCreated', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    await useCase.execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
      facilitatorName: 'Ada',
    });

    expect(ctx.events.published.map((event) => event.type)).toEqual(['GameCreated']);
  });

  it('lanza DeckNotFoundError si el deckId no existe', async () => {
    const ctx = makeContext();
    const useCase = new CreateGame(ctx.games, ctx.decks, ctx.events, ctx.clock, ctx.ids);

    await expect(
      useCase.execute({
        name: 'Sprint 42',
        deckId: 'inexistente',
        settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
        facilitatorName: 'Ada',
      }),
    ).rejects.toThrow('No existe la baraja inexistente.');
  });
});
