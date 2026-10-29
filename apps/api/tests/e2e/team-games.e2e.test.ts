import type { TeamGameView } from '@pp/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp } from './support/httpClient.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

interface CreatedTeam {
  readonly slug: string;
  readonly token: string;
}

describe('histórico de partidas del equipo', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  async function createTeam(name: string): Promise<CreatedTeam> {
    const response = await fetch(`${server.baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return (await response.json()) as CreatedTeam;
  }

  async function createGame(name: string, teamSlug?: string): Promise<string> {
    const { gameId } = await createGameOverHttp(server.baseUrl, {
      name,
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
      ...(teamSlug ? { teamSlug } : {}),
    });
    // Fechas de creación distintas: la paginación `before` compara milisegundos.
    await new Promise((resolve) => setTimeout(resolve, 5));
    return gameId;
  }

  function listGames(team: CreatedTeam, query: Record<string, string> = {}): Promise<Response> {
    const params = new URLSearchParams({ k: team.token, ...query });
    return fetch(`${server.baseUrl}/api/teams/${team.slug}/games?${params.toString()}`);
  }

  it('lista las partidas del equipo de la más reciente a la más antigua', async () => {
    const team = await createTeam('Backend');
    const other = await createTeam('Mobile');
    const first = await createGame('Sprint 41', team.slug);
    const second = await createGame('Sprint 42', team.slug);
    await createGame('De otro equipo', other.slug);
    await createGame('Suelta');

    const response = await listGames(team);
    const games = (await response.json()) as TeamGameView[];

    expect(response.status).toBe(200);
    expect(games.map((game) => game.id)).toEqual([second, first]);
    expect(games[0]).toMatchObject({
      name: 'Sprint 42',
      issueCount: 0,
      estimatedCount: 0,
      participantCount: 1,
    });
  });

  it('pagina con limit y before', async () => {
    const team = await createTeam('Backend');
    const ids = [
      await createGame('Primera', team.slug),
      await createGame('Segunda', team.slug),
      await createGame('Tercera', team.slug),
    ];

    const firstPage = (await (await listGames(team, { limit: '2' })).json()) as TeamGameView[];
    const lastSeen = firstPage.at(-1)?.createdAt ?? '';
    const secondPage = (await (
      await listGames(team, { limit: '2', before: lastSeen })
    ).json()) as TeamGameView[];

    expect(firstPage.map((game) => game.id)).toEqual([ids[2], ids[1]]);
    expect(secondPage.map((game) => game.id)).toEqual([ids[0]]);
  });

  it('responde 404 con un token que no es el del equipo y 400 si falta', async () => {
    const team = await createTeam('Backend');
    await createGame('Sprint 42', team.slug);

    const wrongToken = await listGames({ ...team, token: 'otro-token' });
    const missingToken = await fetch(`${server.baseUrl}/api/teams/${team.slug}/games`);

    expect(wrongToken.status).toBe(404);
    expect(missingToken.status).toBe(400);
  });

  it('responde 400 si limit o before no son válidos', async () => {
    const team = await createTeam('Backend');

    expect((await listGames(team, { limit: '0' })).status).toBe(400);
    expect((await listGames(team, { limit: '1000' })).status).toBe(400);
    expect((await listGames(team, { before: 'ayer' })).status).toBe(400);
  });
});
