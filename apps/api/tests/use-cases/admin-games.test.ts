import { describe, expect, it } from 'vitest';
import { CreateGame } from '../../src/application/use-cases/CreateGame.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { DeleteGame } from '../../src/application/use-cases/DeleteGame.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { ListGamesForAdmin } from '../../src/application/use-cases/ListGamesForAdmin.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { GameId } from '../../src/domain/game/ids.js';
import { makeContext } from './support/context.js';
import type { UseCaseContext } from './support/context.js';
import { RecordingBroadcaster } from './support/RecordingBroadcaster.js';

function createGame(
  ctx: UseCaseContext,
  name: string,
  teamSlug?: string,
): Promise<{ gameId: string }> {
  return new CreateGame(ctx.games, ctx.decks, ctx.teams, ctx.events, ctx.clock, ctx.ids).execute({
    name,
    deckId: SYSTEM_DECK_IDS.fibonacci.value,
    settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
    facilitatorName: 'Ada',
    ...(teamSlug ? { teamSlug } : {}),
  });
}

describe('ListGamesForAdmin', () => {
  it('lista todas las salas con el nombre del equipo del que salieron', async () => {
    const ctx = makeContext();
    const team = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({ name: 'Backend' });
    await createGame(ctx, 'Sin equipo');
    const withTeam = await createGame(ctx, 'Con equipo', team.slug);

    const games = await new ListGamesForAdmin(ctx.games, ctx.teams).execute();

    expect(games).toHaveLength(2);
    expect(games.find((game) => game.id === withTeam.gameId)).toMatchObject({
      name: 'Con equipo',
      team: { id: team.teamId, name: 'Backend' },
      participantCount: 1,
      issueCount: 0,
    });
    expect(games.find((game) => game.name === 'Sin equipo')?.team).toBeNull();
  });
});

describe('DeleteGame', () => {
  it('borra la sala y cierra la mesa de quien siga conectado', async () => {
    const ctx = makeContext();
    const broadcaster = new RecordingBroadcaster();
    const { gameId } = await createGame(ctx, 'Sprint 42');

    await new DeleteGame(ctx.games, broadcaster).execute({ gameId });

    await expect(ctx.games.findById(GameId.of(gameId))).resolves.toBeUndefined();
    expect(broadcaster.closedGameIds).toEqual([gameId]);
  });

  it('lanza GameNotFoundError si la sala no existe, sin avisar a nadie', async () => {
    const ctx = makeContext();
    const broadcaster = new RecordingBroadcaster();

    await expect(
      new DeleteGame(ctx.games, broadcaster).execute({ gameId: 'no-existe' }),
    ).rejects.toThrow(GameNotFoundError);
    expect(broadcaster.closedGameIds).toEqual([]);
  });
});
