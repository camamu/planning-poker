import { describe, expect, it } from 'vitest';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { ListDecks } from '../../src/application/use-cases/ListDecks.js';
import { SaveCustomDeck } from '../../src/application/use-cases/SaveCustomDeck.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { makeContext } from './support/context.js';

describe('ListDecks', () => {
  it('sin teamSlug devuelve solo las dos barajas de sistema', async () => {
    const ctx = makeContext();
    const decks = await new ListDecks(ctx.decks, ctx.teams).execute({});

    expect(decks.map((deck) => deck.name).sort()).toEqual(['Fibonacci', 'Tallas']);
    expect(decks.every((deck) => deck.teamId === null)).toBe(true);
  });

  it('con un equipo válido, añade también sus barajas personalizadas', async () => {
    const ctx = makeContext();
    const team = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({
      name: 'Backend Team',
    });
    await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: team.slug,
      token: team.token,
      name: 'Mi baraja',
      cards: ['1', '2', '3'],
    });

    const decks = await new ListDecks(ctx.decks, ctx.teams).execute({ teamSlug: team.slug });

    expect(decks.map((deck) => deck.name).sort()).toEqual(['Fibonacci', 'Mi baraja', 'Tallas']);
  });

  it('no mezcla barajas personalizadas de otros equipos', async () => {
    const ctx = makeContext();
    const teamA = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name: 'A' });
    const teamB = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name: 'B' });
    await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
      teamSlug: teamA.slug,
      token: teamA.token,
      name: 'Baraja de A',
      cards: ['1'],
    });

    const decksForB = await new ListDecks(ctx.decks, ctx.teams).execute({
      teamSlug: teamB.slug,
    });

    expect(decksForB.map((deck) => deck.name)).not.toContain('Baraja de A');
  });

  it('lanza TeamNotFoundError si el teamSlug no existe', async () => {
    const ctx = makeContext();
    await expect(
      new ListDecks(ctx.decks, ctx.teams).execute({ teamSlug: 'no-existe' }),
    ).rejects.toThrow(TeamNotFoundError);
  });
});
