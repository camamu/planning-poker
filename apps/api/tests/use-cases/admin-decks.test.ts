import { describe, expect, it } from 'vitest';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { DeckNotFoundError } from '../../src/application/use-cases/DeckNotFoundError.js';
import { DeleteDeckAsAdmin } from '../../src/application/use-cases/DeleteDeckAsAdmin.js';
import { ListDecksForAdmin } from '../../src/application/use-cases/ListDecksForAdmin.js';
import { SaveCustomDeck } from '../../src/application/use-cases/SaveCustomDeck.js';
import { DeckId } from '../../src/domain/deck/DeckId.js';
import { SYSTEM_DECK_IDS, SystemDeckNotDeletableError } from '../../src/domain/deck/SavedDeck.js';
import { makeContext } from './support/context.js';
import type { UseCaseContext } from './support/context.js';

async function seedCustomDeck(ctx: UseCaseContext): Promise<{ deckId: string; teamId: string }> {
  const team = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name: 'Backend' });
  const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
    teamSlug: team.slug,
    token: team.token,
    name: 'Horas',
    cards: ['1', '2', '4'],
  });
  return { deckId, teamId: team.teamId };
}

describe('ListDecksForAdmin', () => {
  it('lista solo las barajas personalizadas, con el equipo al que pertenecen', async () => {
    const ctx = makeContext();
    const { deckId, teamId } = await seedCustomDeck(ctx);

    const decks = await new ListDecksForAdmin(ctx.decks, ctx.teams).execute();

    expect(decks).toEqual([
      {
        id: deckId,
        name: 'Horas',
        cards: ['1', '2', '4', '?', '☕'],
        team: { id: teamId, name: 'Backend' },
      },
    ]);
  });
});

describe('DeleteDeckAsAdmin', () => {
  it('borra una baraja personalizada sin necesitar el token del equipo', async () => {
    const ctx = makeContext();
    const { deckId } = await seedCustomDeck(ctx);

    await new DeleteDeckAsAdmin(ctx.decks).execute({ deckId });

    await expect(ctx.decks.findById(DeckId.of(deckId))).resolves.toBeUndefined();
  });

  it('no permite borrar una baraja de sistema', async () => {
    const ctx = makeContext();

    await expect(
      new DeleteDeckAsAdmin(ctx.decks).execute({ deckId: SYSTEM_DECK_IDS.fibonacci.value }),
    ).rejects.toThrow(SystemDeckNotDeletableError);
    await expect(ctx.decks.findById(SYSTEM_DECK_IDS.fibonacci)).resolves.toBeDefined();
  });

  it('lanza DeckNotFoundError si la baraja no existe', async () => {
    const ctx = makeContext();

    await expect(new DeleteDeckAsAdmin(ctx.decks).execute({ deckId: 'no-existe' })).rejects.toThrow(
      DeckNotFoundError,
    );
  });
});
