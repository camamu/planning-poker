import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

async function patchDeck(
  server: TestServer,
  gameId: string,
  participantId: string,
  deckId: string,
): Promise<Response> {
  return fetch(`${server.baseUrl}/api/games/${gameId}/deck`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ participantId, deckId }),
  });
}

describe('cambiar la baraja de una partida en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function createGameWithVoter(): Promise<{
    gameId: string;
    facilitatorId: string;
    voterId: string;
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
    const voterSocket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(voterSocket);
    voterSocket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await once(voterSocket, 'state_sync');
    return {
      gameId: created.gameId,
      facilitatorId: created.facilitatorId,
      voterId: joined.participantId,
      voterSocket,
    };
  }

  it('avisa a la sala con deck_changed y la partida queda con la baraja nueva', async () => {
    const { gameId, facilitatorId, voterId, voterSocket } = await createGameWithVoter();

    const changed = once<Extract<ServerEvent, { type: 'deck_changed' }>>(
      voterSocket,
      'deck_changed',
    );
    const response = await patchDeck(server, gameId, facilitatorId, SYSTEM_DECK_IDS.tshirt.value);

    expect(response.status).toBe(204);
    expect((await changed).deck.cards).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']);

    const state = await fetch(`${server.baseUrl}/api/games/${gameId}?participantId=${voterId}`);
    const body = (await state.json()) as { state: { deck: { cards: string[] } } };
    expect(body.state.deck.cards).toContain('XXL');
  }, 10000);

  it('rechaza con 422 el cambio de un participante que no es facilitador', async () => {
    const { gameId, voterId } = await createGameWithVoter();

    const response = await patchDeck(server, gameId, voterId, SYSTEM_DECK_IDS.tshirt.value);

    expect(response.status).toBe(422);
  }, 10000);

  it('lista las barajas entre las que se puede cambiar', async () => {
    const { gameId } = await createGameWithVoter();

    const response = await fetch(`${server.baseUrl}/api/games/${gameId}/decks`);
    const decks = (await response.json()) as Array<{ name: string }>;

    expect(decks.map((deck) => deck.name).sort()).toEqual(['Fibonacci', 'Tallas']);
  }, 10000);
});
