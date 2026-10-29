import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import {
  createGameOverHttp,
  getGameStateOverHttp,
  joinGameOverHttp,
} from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type IssueEvent<T extends ServerEvent['type']> = Extract<ServerEvent, { type: T }>;

describe('importar tareas en una partida en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function setUpRoom(): Promise<{ gameId: string; voterId: string; voterSocket: Socket }> {
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
    const voterSocket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(voterSocket);
    voterSocket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await once(voterSocket, 'state_sync');
    return { gameId: created.gameId, voterId: joined.participantId, voterSocket };
  }

  async function importIssues(gameId: string, body: unknown): Promise<Response> {
    return fetch(`${server.baseUrl}/api/games/${gameId}/issues/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('importar 3 tareas produce un único issues_imported y ningún issue_added', async () => {
    const { gameId, voterId, voterSocket } = await setUpRoom();
    const received: string[] = [];
    voterSocket.on('issue_added', () => received.push('issue_added'));
    const imported = once<IssueEvent<'issues_imported'>>(voterSocket, 'issues_imported');
    voterSocket.on('issues_imported', () => received.push('issues_imported'));

    const response = await importIssues(gameId, {
      issues: [
        { title: 'ABC-1', externalUrl: 'https://jira.test/browse/ABC-1' },
        { title: 'ABC-2', description: 'Segunda' },
        { title: 'ABC-3' },
      ],
    });

    expect(response.status).toBe(201);
    const { issueIds } = (await response.json()) as { issueIds: string[] };
    expect(issueIds).toHaveLength(3);
    expect((await imported).issueIds).toEqual(issueIds);
    // Margen para que llegara otro evento si, por error, se emitiera uno por tarea.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toEqual(['issues_imported']);

    const state = await getGameStateOverHttp(server.baseUrl, gameId, voterId);
    expect(
      state.state.issues.map((issue) => [issue.title, issue.description, issue.externalUrl]),
    ).toEqual([
      ['ABC-1', null, 'https://jira.test/browse/ABC-1'],
      ['ABC-2', 'Segunda', null],
      ['ABC-3', null, null],
    ]);
  }, 10000);

  it.each([
    ['una lista vacía', { issues: [] }],
    ['un título vacío', { issues: [{ title: 'Primera' }, { title: '   ' }] }],
    [
      'un enlace que no es http(s)',
      { issues: [{ title: 'Primera', externalUrl: 'javascript:alert(1)' }] },
    ],
    [
      'más de 200 tareas',
      {
        issues: Array.from({ length: 201 }, (_, index) => ({ title: `Tarea ${index.toString()}` })),
      },
    ],
  ])(
    'rechaza con 400 y no añade ninguna tarea si el lote trae %s',
    async (_caso, body) => {
      const { gameId, voterId } = await setUpRoom();

      const response = await importIssues(gameId, body);

      expect(response.status).toBe(400);
      const state = await getGameStateOverHttp(server.baseUrl, gameId, voterId);
      expect(state.state.issues).toEqual([]);
    },
    10000,
  );

  it('acepta exactamente 200 tareas', async () => {
    const { gameId, voterId } = await setUpRoom();

    const response = await importIssues(gameId, {
      issues: Array.from({ length: 200 }, (_, index) => ({ title: `Tarea ${index.toString()}` })),
    });

    expect(response.status).toBe(201);
    const state = await getGameStateOverHttp(server.baseUrl, gameId, voterId);
    expect(state.state.issues).toHaveLength(200);
  }, 10000);

  it('responde 404 si la partida no existe', async () => {
    const response = await importIssues('inexistente', { issues: [{ title: 'Primera' }] });

    expect(response.status).toBe(404);
  });
});
