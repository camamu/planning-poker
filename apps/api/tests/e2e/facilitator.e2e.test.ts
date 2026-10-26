import type { EphemeralEvent, ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type StateSync = Extract<ServerEvent, { type: 'state_sync' }>;
type FacilitatorChanged = Extract<ServerEvent, { type: 'facilitator_changed' }>;
type PresenceChanged = Extract<EphemeralEvent, { type: 'presence_changed' }>;

describe('traspaso de facilitador en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer({ presenceGraceMs: 40 });
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  function connect(gameId: string, participantId: string): Socket {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    socket.emit('join', { gameId, participantId });
    return socket;
  }

  async function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function createGameWithGuest(): Promise<{
    gameId: string;
    facilitatorId: string;
    guestId: string;
  }> {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
    });
    const guest = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });
    return {
      gameId: created.gameId,
      facilitatorId: created.facilitatorId,
      guestId: guest.participantId,
    };
  }

  it('avisa a toda la sala con facilitator_changed cuando el facilitador cede el rol', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');
    const guest = connect(gameId, guestId);
    await once(guest, 'state_sync');
    const facilitatorNotified = once<FacilitatorChanged>(facilitator, 'facilitator_changed');
    const guestNotified = once<FacilitatorChanged>(guest, 'facilitator_changed');

    const response = await postJson(`/api/games/${gameId}/facilitator`, {
      participantId: facilitatorId,
      toParticipantId: guestId,
    });

    expect(response.status).toBe(204);
    for (const event of [await facilitatorNotified, await guestNotified]) {
      expect(event.previousId).toBe(facilitatorId);
      expect(event.nextId).toBe(guestId);
    }

    const rejoined = connect(gameId, guestId);
    const sync = await once<StateSync>(rejoined, 'state_sync');
    expect(
      sync.state.participants
        .filter((participant) => participant.isFacilitator)
        .map((participant) => participant.id),
    ).toEqual([guestId]);
  });

  it('rechaza con 422 que lo ceda quien no es el facilitador', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();

    const response = await postJson(`/api/games/${gameId}/facilitator`, {
      participantId: guestId,
      toParticipantId: facilitatorId,
    });

    expect(response.status).toBe(422);
  });

  it('deja tomar el relevo cuando el facilitador se desconecta y pasa el margen de gracia', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');
    const guest = connect(gameId, guestId);
    await once(guest, 'state_sync');

    const wentOffline = once<PresenceChanged>(guest, 'presence_changed');
    facilitator.disconnect();
    expect(await wentOffline).toMatchObject({ participantId: facilitatorId, online: false });

    const notified = once<FacilitatorChanged>(guest, 'facilitator_changed');
    const response = await postJson(`/api/games/${gameId}/facilitator/claim`, {
      participantId: guestId,
    });

    expect(response.status).toBe(204);
    expect(await notified).toMatchObject({ previousId: facilitatorId, nextId: guestId });
  });

  it('rechaza con 422 el relevo mientras el facilitador sigue conectado', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');
    const guest = connect(gameId, guestId);
    await once(guest, 'state_sync');

    const response = await postJson(`/api/games/${gameId}/facilitator/claim`, {
      participantId: guestId,
    });

    expect(response.status).toBe(422);
  });
});
