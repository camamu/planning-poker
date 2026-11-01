import { describe, expect, it } from 'vitest';
import { CreateGame } from '../../src/application/use-cases/CreateGame.js';
import type { CreateTeamResult } from '../../src/application/use-cases/CreateTeam.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { ListTeamGames } from '../../src/application/use-cases/ListTeamGames.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { InMemoryGameHistoryReader } from '../../src/infrastructure/persistence/in-memory/InMemoryGameHistoryReader.js';
import { InMemoryGameRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { makeContext, NOW } from './support/context.js';

function minutesAfterNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

interface Scenario {
  readonly createTeam: (name: string) => Promise<CreateTeamResult>;
  readonly createGameAt: (name: string, at: Date, teamSlug?: string) => Promise<void>;
  readonly listTeamGames: ListTeamGames;
}

function setUp(): Scenario {
  const ctx = makeContext();
  let creationDate = NOW;
  const games = new InMemoryGameRepository(() => creationDate);
  const createGame = new CreateGame(games, ctx.decks, ctx.teams, ctx.events, ctx.clock, ctx.ids);
  const listTeamGames = new ListTeamGames(
    ctx.teams,
    ctx.hasher,
    new InMemoryGameHistoryReader(games),
  );

  return {
    createTeam: (name: string) => new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name }),
    createGameAt: async (name: string, at: Date, teamSlug?: string): Promise<void> => {
      creationDate = at;
      await createGame.execute({
        name,
        deckId: SYSTEM_DECK_IDS.fibonacci.value,
        settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
        facilitatorName: 'Ada',
        teamSlug,
      });
    },
    listTeamGames,
  };
}

describe('ListTeamGames', () => {
  it('lista las partidas del equipo, la más reciente primero', async () => {
    const { createTeam, createGameAt, listTeamGames } = setUp();
    const team = await createTeam('Backend');
    await createGameAt('Sprint 41', minutesAfterNow(1), team.slug);
    await createGameAt('Sprint 42', minutesAfterNow(2), team.slug);

    const games = await listTeamGames.execute({ slug: team.slug, token: team.token, limit: 20 });

    expect(games.map((game) => game.name)).toEqual(['Sprint 42', 'Sprint 41']);
    expect(games[0]).toMatchObject({
      createdAt: minutesAfterNow(2).toISOString(),
      issueCount: 0,
      estimatedCount: 0,
      participantCount: 1,
    });
  });

  it('no lista las partidas de otro equipo ni las creadas fuera de un equipo', async () => {
    const { createTeam, createGameAt, listTeamGames } = setUp();
    const backend = await createTeam('Backend');
    const mobile = await createTeam('Mobile');
    await createGameAt('De backend', minutesAfterNow(1), backend.slug);
    await createGameAt('De mobile', minutesAfterNow(2), mobile.slug);
    await createGameAt('Suelta', minutesAfterNow(3));

    const games = await listTeamGames.execute({
      slug: backend.slug,
      token: backend.token,
      limit: 20,
    });

    expect(games.map((game) => game.name)).toEqual(['De backend']);
  });

  it('no lista partidas con un token de equipo incorrecto', async () => {
    const { createTeam, createGameAt, listTeamGames } = setUp();
    const team = await createTeam('Backend');
    await createGameAt('Sprint 42', minutesAfterNow(1), team.slug);

    await expect(
      listTeamGames.execute({ slug: team.slug, token: 'token-equivocado', limit: 20 }),
    ).rejects.toThrow(TeamNotFoundError);
  });

  it('no lista partidas con el token de otro equipo', async () => {
    const { createTeam, listTeamGames } = setUp();
    const backend = await createTeam('Backend');
    const mobile = await createTeam('Mobile');

    await expect(
      listTeamGames.execute({ slug: backend.slug, token: mobile.token, limit: 20 }),
    ).rejects.toThrow(TeamNotFoundError);
  });

  it('pagina por fecha: before devuelve solo las partidas anteriores a la última vista', async () => {
    const { createTeam, createGameAt, listTeamGames } = setUp();
    const team = await createTeam('Backend');
    await createGameAt('Primera', minutesAfterNow(1), team.slug);
    await createGameAt('Segunda', minutesAfterNow(2), team.slug);
    await createGameAt('Tercera', minutesAfterNow(3), team.slug);

    const firstPage = await listTeamGames.execute({ slug: team.slug, token: team.token, limit: 2 });
    const lastSeen = firstPage.at(-1)?.createdAt;
    const secondPage = await listTeamGames.execute({
      slug: team.slug,
      token: team.token,
      limit: 2,
      before: lastSeen === undefined ? undefined : new Date(lastSeen),
    });

    expect(firstPage.map((game) => game.name)).toEqual(['Tercera', 'Segunda']);
    expect(secondPage.map((game) => game.name)).toEqual(['Primera']);
  });
});
