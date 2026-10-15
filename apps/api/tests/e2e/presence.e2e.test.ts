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
type PresenceChanged = Extract<EphemeralEvent, { type: 'presence_changed' }>;

describe('presencia y salida de participantes en vivo', () => {
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

  async function createGameWithGuest(
    autoReveal = false,
  ): Promise<{ gameId: string; facilitatorId: string; guestId: string }> {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal, whoCanReveal: 'ANYONE' },
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

  it('avisa a la sala cuando alguien entra y, pasado el margen de gracia, cuando se va', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');

    const cameOnline = once<PresenceChanged>(facilitator, 'presence_changed');
    const guest = connect(gameId, guestId);
    const guestSync = await once<StateSync>(guest, 'state_sync');
    expect((await cameOnline).online).toBe(true);
    expect(guestSync.state.participants.find((p) => p.id === guestId)?.online).toBe(true);

    const wentOffline = once<PresenceChanged>(facilitator, 'presence_changed');
    guest.disconnect();
    expect(await wentOffline).toEqual({
      type: 'presence_changed',
      participantId: guestId,
      online: false,
    });
  });

  it('revela sola la ronda al desconectarse el único votante presente que faltaba', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest(true);
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');
    const guest = connect(gameId, guestId);
    await once(guest, 'state_sync');

    facilitator.emit('start_quick_round', { gameId, participantId: facilitatorId });
    await once(facilitator, 'round_started');
    facilitator.emit('vote', { gameId, participantId: facilitatorId, card: '5' });
    await once(facilitator, 'participant_voted');

    const revealed = once<Extract<ServerEvent, { type: 'round_revealed' }>>(
      facilitator,
      'round_revealed',
    );
    guest.disconnect();

    expect((await revealed).votes).toEqual([{ participantId: facilitatorId, card: '5' }]);
  });

  it('avisa con participant_left cuando el facilitador quita a alguien y le cierra la puerta', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();
    const facilitator = connect(gameId, facilitatorId);
    await once(facilitator, 'state_sync');
    const guest = connect(gameId, guestId);
    await once(guest, 'state_sync');

    const guestNotified = once<Extract<ServerEvent, { type: 'participant_left' }>>(
      guest,
      'participant_left',
    );
    const response = await fetch(`${server.baseUrl}/api/games/${gameId}/participants/${guestId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: facilitatorId }),
    });

    expect(response.status).toBe(204);
    expect((await guestNotified).participantId).toBe(guestId);

    const retry = connect(gameId, guestId);
    expect(await once<{ type: string }>(retry, 'left_game')).toEqual({ type: 'left_game' });
  });

  it('rechaza que un participante quite a otro con 422', async () => {
    const { gameId, facilitatorId, guestId } = await createGameWithGuest();

    const response = await fetch(
      `${server.baseUrl}/api/games/${gameId}/participants/${facilitatorId}`,
      {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ participantId: guestId }),
      },
    );

    expect(response.status).toBe(422);
  });
});
