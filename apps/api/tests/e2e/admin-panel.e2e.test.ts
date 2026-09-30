import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { hashAdminPassword } from '../../src/infrastructure/security/ScryptAdminCredentials.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { TEST_ADMIN, startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

const sessionSchema = z.object({ token: z.string(), expiresAt: z.string() });
const teamSchema = z.object({ teamId: z.string(), slug: z.string(), token: z.string() });
const adminGamesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    team: z.object({ id: z.string(), name: z.string() }).nullable(),
  }),
);
const adminTeamsSchema = z.array(
  z.object({ id: z.string(), name: z.string(), deckCount: z.number(), gameCount: z.number() }),
);
const adminDecksSchema = z.array(z.object({ id: z.string(), name: z.string() }));
const regeneratedTokenSchema = z.object({ slug: z.string(), token: z.string() });

describe('panel de gestión', () => {
  let adminPasswordHash: string;
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    adminPasswordHash = await hashAdminPassword(TEST_ADMIN.password);
  });

  beforeEach(async () => {
    server = await startTestServer({ adminPasswordHash });
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  function logIn(username: string, password: string): Promise<Response> {
    return fetch(`${server.baseUrl}/api/admin/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  }

  async function adminToken(): Promise<string> {
    const response = await logIn(TEST_ADMIN.username, TEST_ADMIN.password);
    return sessionSchema.parse(await response.json()).token;
  }

  function adminRequest(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    return fetch(`${server.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async function createTeam(name: string): Promise<z.infer<typeof teamSchema>> {
    const response = await fetch(`${server.baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return teamSchema.parse(await response.json());
  }

  it('rechaza credenciales incorrectas con 401 y bloquea la IP tras 5 fallos', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await logIn(TEST_ADMIN.username, 'incorrecta')).status).toBe(401);
    }

    expect((await logIn(TEST_ADMIN.username, TEST_ADMIN.password)).status).toBe(429);
  });

  it('no deja entrar en /api/admin/* sin sesión o con un token falso', async () => {
    expect((await fetch(`${server.baseUrl}/api/admin/games`)).status).toBe(401);
    expect((await adminRequest('123.firma-falsa', 'GET', '/api/admin/teams')).status).toBe(401);
    expect((await adminRequest('123.firma-falsa', 'DELETE', '/api/admin/decks/x')).status).toBe(
      401,
    );
  });

  it('borra una sala y echa de la mesa a quien siga conectado', async () => {
    const token = await adminToken();
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
    });
    const joined = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    socket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await once(socket, 'state_sync');

    const listed = adminGamesSchema.parse(
      await (await adminRequest(token, 'GET', '/api/admin/games')).json(),
    );
    expect(listed.map((game) => game.id)).toEqual([created.gameId]);

    const closed = once<{ type: string }>(socket, 'game_closed');
    const response = await adminRequest(token, 'DELETE', `/api/admin/games/${created.gameId}`);

    expect(response.status).toBe(204);
    expect((await closed).type).toBe('game_closed');
    const state = await fetch(
      `${server.baseUrl}/api/games/${created.gameId}?participantId=${joined.participantId}`,
    );
    expect(state.status).toBe(404);
  }, 10000);

  it('renombra un equipo, regenera su enlace y lo borra con sus barajas', async () => {
    const token = await adminToken();
    const team = await createTeam('Backend');
    await fetch(`${server.baseUrl}/api/teams/${team.slug}/decks?k=${team.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Horas', cards: ['1', '2', '4'] }),
    });

    const renamed = await adminRequest(token, 'PATCH', `/api/admin/teams/${team.teamId}`, {
      name: 'Plataforma',
    });
    expect(renamed.status).toBe(204);
    const teams = adminTeamsSchema.parse(
      await (await adminRequest(token, 'GET', '/api/admin/teams')).json(),
    );
    expect(teams).toEqual([{ id: team.teamId, name: 'Plataforma', deckCount: 1, gameCount: 0 }]);

    const regenerated = regeneratedTokenSchema.parse(
      await (await adminRequest(token, 'POST', `/api/admin/teams/${team.teamId}/token`)).json(),
    );
    expect((await fetch(`${server.baseUrl}/api/teams/${team.slug}?k=${team.token}`)).status).toBe(
      404,
    );
    expect(
      (await fetch(`${server.baseUrl}/api/teams/${team.slug}?k=${regenerated.token}`)).status,
    ).toBe(200);

    expect((await adminRequest(token, 'DELETE', `/api/admin/teams/${team.teamId}`)).status).toBe(
      204,
    );
    const decks = adminDecksSchema.parse(
      await (await adminRequest(token, 'GET', '/api/admin/decks')).json(),
    );
    expect(decks).toEqual([]);
  });

  it('borra barajas personalizadas pero no las de sistema', async () => {
    const token = await adminToken();
    const team = await createTeam('Backend');
    await fetch(`${server.baseUrl}/api/teams/${team.slug}/decks?k=${team.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Horas', cards: ['1', '2', '4'] }),
    });
    const [deck] = adminDecksSchema.parse(
      await (await adminRequest(token, 'GET', '/api/admin/decks')).json(),
    );

    const system = await adminRequest(
      token,
      'DELETE',
      `/api/admin/decks/${SYSTEM_DECK_IDS.fibonacci.value}`,
    );
    const custom = await adminRequest(token, 'DELETE', `/api/admin/decks/${deck?.id ?? ''}`);

    expect(system.status).toBe(422);
    expect(custom.status).toBe(204);
  });
});
