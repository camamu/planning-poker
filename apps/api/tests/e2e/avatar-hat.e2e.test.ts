import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

async function patchHat(
  server: TestServer,
  gameId: string,
  targetId: string,
  requestedBy: string,
  hat: string | null,
): Promise<Response> {
  return fetch(`${server.baseUrl}/api/games/${gameId}/participants/${targetId}/hat`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ participantId: requestedBy, hat }),
  });
}

describe('sombreros de avatar en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function createGameWithWatcher(): Promise<{
    gameId: string;
    facilitatorId: string;
    voterId: string;
    facilitatorSocket: Socket;
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
    const facilitatorSocket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(facilitatorSocket);
    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    await once(facilitatorSocket, 'state_sync');
    return {
      gameId: created.gameId,
      facilitatorId: created.facilitatorId,
      voterId: joined.participantId,
      facilitatorSocket,
    };
  }

  it('avisa a la sala con participant_hat_changed y el estado conserva el sombrero', async () => {
    const { gameId, facilitatorId, voterId, facilitatorSocket } = await createGameWithWatcher();

    const changed = once<Extract<ServerEvent, { type: 'participant_hat_changed' }>>(
      facilitatorSocket,
      'participant_hat_changed',
    );
    const response = await patchHat(server, gameId, voterId, voterId, 'cowboy');

    expect(response.status).toBe(204);
    const event = await changed;
    expect(event.participantId).toBe(voterId);
    expect(event.hat).toBe('cowboy');

    const state = await fetch(
      `${server.baseUrl}/api/games/${gameId}?participantId=${facilitatorId}`,
    );
    const body = (await state.json()) as {
      state: { participants: Array<{ id: string; hat: string | null }> };
    };
    expect(body.state.participants.find((p) => p.id === voterId)?.hat).toBe('cowboy');
  }, 10000);

  it('rechaza con 422 que el facilitador cambie el sombrero de otro', async () => {
    const { gameId, facilitatorId, voterId } = await createGameWithWatcher();

    const response = await patchHat(server, gameId, voterId, facilitatorId, 'crown');

    expect(response.status).toBe(422);
  }, 10000);

  it('rechaza con 400 un sombrero fuera del catálogo', async () => {
    const { gameId, voterId } = await createGameWithWatcher();

    const response = await patchHat(server, gameId, voterId, voterId, 'casco-de-moto');

    expect(response.status).toBe(400);
  }, 10000);
});
