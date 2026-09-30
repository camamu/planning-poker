import { describe, expect, it } from 'vitest';
import { AuthenticateTeam } from '../../src/application/use-cases/AuthenticateTeam.js';
import { CreateGame } from '../../src/application/use-cases/CreateGame.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import type { CreateTeamResult } from '../../src/application/use-cases/CreateTeam.js';
import { DeleteTeam } from '../../src/application/use-cases/DeleteTeam.js';
import { ListTeamsForAdmin } from '../../src/application/use-cases/ListTeamsForAdmin.js';
import { RegenerateTeamToken } from '../../src/application/use-cases/RegenerateTeamToken.js';
import { RenameTeam } from '../../src/application/use-cases/RenameTeam.js';
import { SaveCustomDeck } from '../../src/application/use-cases/SaveCustomDeck.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { DeckId } from '../../src/domain/deck/DeckId.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { GameId } from '../../src/domain/game/ids.js';
import { InvalidTeamNameError } from '../../src/domain/team/TeamName.js';
import { makeContext } from './support/context.js';
import type { UseCaseContext } from './support/context.js';

function createTeam(ctx: UseCaseContext, name = 'Backend'): Promise<CreateTeamResult> {
  return new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name });
}

async function saveDeck(ctx: UseCaseContext, team: CreateTeamResult): Promise<string> {
  const { deckId } = await new SaveCustomDeck(ctx.decks, ctx.teams, ctx.hasher, ctx.ids).execute({
    teamSlug: team.slug,
    token: team.token,
    name: 'Horas',
    cards: ['1', '2', '4'],
  });
  return deckId;
}

async function createGameFor(ctx: UseCaseContext, team: CreateTeamResult): Promise<string> {
  const { gameId } = await new CreateGame(
    ctx.games,
    ctx.decks,
    ctx.teams,
    ctx.events,
    ctx.clock,
    ctx.ids,
  ).execute({
    name: 'Sprint 42',
    deckId: SYSTEM_DECK_IDS.fibonacci.value,
    settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
    facilitatorName: 'Ada',
    teamSlug: team.slug,
  });
  return gameId;
}

describe('ListTeamsForAdmin', () => {
  it('lista los equipos con cuántas barajas y salas tiene cada uno', async () => {
    const ctx = makeContext();
    const backend = await createTeam(ctx, 'Backend');
    await createTeam(ctx, 'Diseño');
    await saveDeck(ctx, backend);
    await createGameFor(ctx, backend);
    await createGameFor(ctx, backend);

    const teams = await new ListTeamsForAdmin(ctx.teams, ctx.decks, ctx.games).execute();

    expect(teams).toEqual([
      { id: backend.teamId, slug: backend.slug, name: 'Backend', deckCount: 1, gameCount: 2 },
      expect.objectContaining({ name: 'Diseño', deckCount: 0, gameCount: 0 }),
    ]);
  });
});

describe('RenameTeam', () => {
  it('renombra el equipo sin invalidar su enlace', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    await new RenameTeam(ctx.teams).execute({ teamId: team.teamId, name: 'Plataforma' });

    const authenticated = await new AuthenticateTeam(ctx.teams, ctx.hasher).execute({
      slug: team.slug,
      token: team.token,
    });
    expect(authenticated.name).toBe('Plataforma');
  });

  it('no permite dejar un equipo sin nombre', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    await expect(
      new RenameTeam(ctx.teams).execute({ teamId: team.teamId, name: '   ' }),
    ).rejects.toThrow(InvalidTeamNameError);
  });

  it('lanza TeamNotFoundError si el equipo no existe', async () => {
    const ctx = makeContext();

    await expect(
      new RenameTeam(ctx.teams).execute({ teamId: 'no-existe', name: 'Plataforma' }),
    ).rejects.toThrow(TeamNotFoundError);
  });
});

describe('RegenerateTeamToken', () => {
  it('emite un token nuevo que abre el equipo y deja inservible el anterior', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);

    const regenerated = await new RegenerateTeamToken(ctx.teams, ctx.hasher, ctx.ids).execute({
      teamId: team.teamId,
    });

    const authenticate = new AuthenticateTeam(ctx.teams, ctx.hasher);
    expect(regenerated.slug).toBe(team.slug);
    expect(regenerated.token).not.toBe(team.token);
    await expect(
      authenticate.execute({ slug: team.slug, token: regenerated.token }),
    ).resolves.toMatchObject({ name: 'Backend' });
    await expect(authenticate.execute({ slug: team.slug, token: team.token })).rejects.toThrow(
      TeamNotFoundError,
    );
  });
});

describe('DeleteTeam', () => {
  it('borra el equipo y sus barajas, pero conserva sus salas', async () => {
    const ctx = makeContext();
    const team = await createTeam(ctx);
    const deckId = await saveDeck(ctx, team);
    const gameId = await createGameFor(ctx, team);

    await new DeleteTeam(ctx.teams, ctx.decks).execute({ teamId: team.teamId });

    await expect(ctx.teams.listAll()).resolves.toEqual([]);
    await expect(ctx.decks.findById(DeckId.of(deckId))).resolves.toBeUndefined();
    await expect(ctx.games.findById(GameId.of(gameId))).resolves.toBeDefined();
  });

  it('lanza TeamNotFoundError si el equipo no existe', async () => {
    const ctx = makeContext();

    await expect(
      new DeleteTeam(ctx.teams, ctx.decks).execute({ teamId: 'no-existe' }),
    ).rejects.toThrow(TeamNotFoundError);
  });
});
