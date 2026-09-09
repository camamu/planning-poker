import { describe, expect, it } from 'vitest';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import type { CreateTeamResult } from '../../src/application/use-cases/CreateTeam.js';
import { DeckNotFoundError } from '../../src/application/use-cases/DeckNotFoundError.js';
import { DeleteCustomDeck } from '../../src/application/use-cases/DeleteCustomDeck.js';
import { SaveCustomDeck } from '../../src/application/use-cases/SaveCustomDeck.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { UpdateCustomDeck } from '../../src/application/use-cases/UpdateCustomDeck.js';
import { DeckId } from '../../src/domain/deck/DeckId.js';
import { DeckNotOwnedByTeamError } from '../../src/domain/deck/SavedDeck.js';
import { makeContext } from './support/context.js';

function createTeam(
  ctx: ReturnType<typeof makeContext>,
  name = 'Backend Team',
): Promise<CreateTeamResult> {
  return new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name });
}

describe('SaveCustomDeck', () => {
  it('crea la baraja, siempre con "?" y "☕" al final', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: team.slug,
      token: team.token,
      name: 'Mi baraja',
      cards: ['1', '2'],
    });

    const stored = await ctx.decks.findById(DeckId.of(deckId));
    expect(
      stored
        ?.currentDeck()
        .values()
        .map((card) => card.raw),
    ).toEqual(['1', '2', '?', '☕']);
  });

  it('rechaza el token equivocado', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    await expect(
      new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
        teamSlug: team.slug,
        token: 'token-equivocado',
        name: 'Mi baraja',
        cards: ['1'],
      }),
    ).rejects.toThrow(TeamNotFoundError);
  });
});

describe('UpdateCustomDeck', () => {
  it('sustituye nombre y cartas conservando el id', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);
    const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: team.slug,
      token: team.token,
      name: 'Mi baraja',
      cards: ['1', '2'],
    });

    await new UpdateCustomDeck(ctx.decks, ctx.teams, ctx.hasher).execute({
      teamSlug: team.slug,
      token: team.token,
      deckId,
      name: 'Renombrada',
      cards: ['5', '8'],
    });

    const stored = await ctx.decks.findById(DeckId.of(deckId));
    expect(stored?.name.value).toBe('Renombrada');
    expect(
      stored
        ?.currentDeck()
        .values()
        .map((card) => card.raw),
    ).toEqual(['5', '8', '?', '☕']);
  });

  it('lanza DeckNotOwnedByTeamError si otro equipo intenta editarla', async () => {
    const ctx = makeContext();
    const owner = await createTeam(ctx, 'Dueña');
    const other = await createTeam(ctx, 'Intrusa');
    const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: owner.slug,
      token: owner.token,
      name: 'Mi baraja',
      cards: ['1'],
    });

    await expect(
      new UpdateCustomDeck(ctx.decks, ctx.teams, ctx.hasher).execute({
        teamSlug: other.slug,
        token: other.token,
        deckId,
        name: 'Robada',
        cards: ['9'],
      }),
    ).rejects.toThrow(DeckNotOwnedByTeamError);
  });

  it('lanza DeckNotFoundError si el deckId no existe', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    await expect(
      new UpdateCustomDeck(ctx.decks, ctx.teams, ctx.hasher).execute({
        teamSlug: team.slug,
        token: team.token,
        deckId: 'inexistente',
        name: 'X',
        cards: ['1'],
      }),
    ).rejects.toThrow(DeckNotFoundError);
  });
});

describe('DeleteCustomDeck', () => {
  it('borra la baraja del equipo dueño', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);
    const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: team.slug,
      token: team.token,
      name: 'Mi baraja',
      cards: ['1'],
    });

    await new DeleteCustomDeck(ctx.decks, ctx.teams, ctx.hasher).execute({
      teamSlug: team.slug,
      token: team.token,
      deckId,
    });

    await expect(ctx.decks.findById(DeckId.of(deckId))).resolves.toBeUndefined();
  });

  it('no permite borrar una baraja de sistema (no pertenece a ningún equipo)', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);
    const systemDecks = await ctx.decks.listAvailableFor(null);
    const systemDeckId = systemDecks[0]?.id.value;
    if (!systemDeckId) throw new Error('no hay barajas de sistema sembradas');

    await expect(
      new DeleteCustomDeck(ctx.decks, ctx.teams, ctx.hasher).execute({
        teamSlug: team.slug,
        token: team.token,
        deckId: systemDeckId,
      }),
    ).rejects.toThrow(DeckNotOwnedByTeamError);
  });
});
