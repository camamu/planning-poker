import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import {
  addIssueOverHttp,
  createGameOverHttp,
  getGameStateOverHttp,
  joinGameOverHttp,
} from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type IssueEvent<T extends ServerEvent['type']> = Extract<ServerEvent, { type: T }>;

describe('gestionar las tareas de una partida en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function sendJson(
    method: 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
  ): Promise<Response> {
    return fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function setUpRoom(): Promise<{
    gameId: string;
    facilitatorId: string;
    voterId: string;
    issueIds: [string, string, string];
    voterSocket: Socket;
  }> {
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
    const addIssue = async (title: string): Promise<string> =>
      (await addIssueOverHttp(server.baseUrl, created.gameId, { title })).issueId;
    const issueIds: [string, string, string] = [
      await addIssue('Primera'),
      await addIssue('Segunda'),
      await addIssue('Tercera'),
    ];
    const voterSocket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(voterSocket);
    voterSocket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await once(voterSocket, 'state_sync');
    return {
      gameId: created.gameId,
      facilitatorId: created.facilitatorId,
      voterId: joined.participantId,
      issueIds,
      voterSocket,
    };
  }

  it('avisa a la sala con issues_reordered cuando un participante reordena la cola', async () => {
    const { gameId, facilitatorId, issueIds, voterSocket } = await setUpRoom();
    const [first, second, third] = issueIds;
    const reordered = once<IssueEvent<'issues_reordered'>>(voterSocket, 'issues_reordered');

    const response = await sendJson('PUT', `/api/games/${gameId}/issues/order`, {
      participantId: facilitatorId,
      issueIds: [third, first, second],
    });

    expect(response.status).toBe(204);
    expect((await reordered).issueIds).toEqual([third, first, second]);
  }, 10000);

  it('avisa a la sala con issue_edited y la tarea editada sobrevive a recargar el estado', async () => {
    const { gameId, facilitatorId, voterId, issueIds, voterSocket } = await setUpRoom();
    const [first] = issueIds;
    const edited = once<IssueEvent<'issue_edited'>>(voterSocket, 'issue_edited');

    const response = await sendJson('PATCH', `/api/games/${gameId}/issues/${first}`, {
      participantId: facilitatorId,
      title: 'Primera, corregida',
    });

    expect(response.status).toBe(204);
    expect((await edited).issue).toEqual({
      id: first,
      title: 'Primera, corregida',
      description: null,
      externalUrl: null,
      status: 'PENDING',
      finalEstimate: null,
    });
    const state = await getGameStateOverHttp(server.baseUrl, gameId, voterId);
    expect(state.state.issues[0]?.title).toBe('Primera, corregida');
  }, 10000);

  it('avisa a la sala con issue_removed cuando se borra una tarea sin rondas', async () => {
    const { gameId, facilitatorId, issueIds, voterSocket } = await setUpRoom();
    const [, second] = issueIds;
    const removed = once<IssueEvent<'issue_removed'>>(voterSocket, 'issue_removed');

    const response = await sendJson('DELETE', `/api/games/${gameId}/issues/${second}`, {
      participantId: facilitatorId,
    });

    expect(response.status).toBe(204);
    expect(await removed).toMatchObject({ issueId: second, dealerId: null });
  }, 10000);

  it('incluye el dealer nuevo en issue_removed cuando borrar una tarea anterior mueve la posición de la actual', async () => {
    const { gameId, facilitatorId, voterId, issueIds, voterSocket } = await setUpRoom();
    const [first, second] = issueIds;
    voterSocket.emit('start_round', { gameId, participantId: facilitatorId, issueId: second });
    await once(voterSocket, 'round_started');
    const before = await getGameStateOverHttp(server.baseUrl, gameId, facilitatorId);
    expect(before.state.currentRound?.dealerId).toBe(voterId);
    const removed = once<IssueEvent<'issue_removed'>>(voterSocket, 'issue_removed');

    await sendJson('DELETE', `/api/games/${gameId}/issues/${first}`, {
      participantId: facilitatorId,
    });

    expect((await removed).dealerId).toBe(facilitatorId);
    const after = await getGameStateOverHttp(server.baseUrl, gameId, facilitatorId);
    expect(after.state.currentRound?.dealerId).toBe(facilitatorId);
  }, 10000);

  it('rechaza con 422 borrar una tarea que ya tiene ronda', async () => {
    const { gameId, facilitatorId, issueIds, voterSocket } = await setUpRoom();
    const [first] = issueIds;
    voterSocket.emit('start_round', { gameId, participantId: facilitatorId, issueId: first });
    await once(voterSocket, 'round_started');

    const response = await sendJson('DELETE', `/api/games/${gameId}/issues/${first}`, {
      participantId: facilitatorId,
    });

    expect(response.status).toBe(422);
    const state = await getGameStateOverHttp(server.baseUrl, gameId, facilitatorId);
    expect(state.state.currentRound).not.toBeNull();
  }, 10000);

  it('rechaza con 422 un orden que no contiene exactamente las tareas de la partida', async () => {
    const { gameId, facilitatorId, issueIds } = await setUpRoom();

    const response = await sendJson('PUT', `/api/games/${gameId}/issues/order`, {
      participantId: facilitatorId,
      issueIds: issueIds.slice(1),
    });

    expect(response.status).toBe(422);
  }, 10000);

  it('rechaza con 400 un enlace externo que no es http(s)', async () => {
    const { gameId, facilitatorId, issueIds } = await setUpRoom();
    const [first] = issueIds;

    const response = await sendJson('PATCH', `/api/games/${gameId}/issues/${first}`, {
      participantId: facilitatorId,
      title: 'Primera',
      externalUrl: 'javascript:alert(1)',
    });

    expect(response.status).toBe(400);
  }, 10000);

  it('rechaza con 422 a quien no es participante de la partida', async () => {
    const { gameId, issueIds } = await setUpRoom();
    const [first] = issueIds;

    const response = await sendJson('PATCH', `/api/games/${gameId}/issues/${first}`, {
      participantId: 'nadie',
      title: 'Otro título',
    });

    expect(response.status).toBe(422);
  }, 10000);
});
