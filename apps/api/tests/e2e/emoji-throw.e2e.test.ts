import type { EphemeralEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type EphemeralOf<Type extends EphemeralEvent['type']> = Extract<EphemeralEvent, { type: Type }>;

/**
 * `emoji_thrown` es flair transitorio, fuera del agregado `Game` (docs/adr/
 * 0005-extension-de-alcance-bloque-6.md): no pasa por ningún caso de uso ni por
 * `WsEventPublisher`, así que este test cubre la gateway directamente, no un caso de uso.
 */
describe('lanzar/reaccionar con emoji (flair transitorio, fuera del agregado)', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  function connect(): Socket {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    return socket;
  }

  it('reenvía un emoji lanzado a toda la room cuando throwEmojis está activado', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE', throwEmojis: true },
    });
    const joined = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });

    const facilitatorSocket = connect();
    const voterSocket = connect();
    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    voterSocket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await Promise.all([once(facilitatorSocket, 'state_sync'), once(voterSocket, 'state_sync')]);

    const emojiOnVoter = once<EphemeralOf<'emoji_thrown'>>(voterSocket, 'emoji_thrown');
    facilitatorSocket.emit('emoji_thrown', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      toParticipantId: joined.participantId,
      emoji: '👏',
    });

    expect(await emojiOnVoter).toEqual({
      type: 'emoji_thrown',
      fromParticipantId: created.facilitatorId,
      toParticipantId: joined.participantId,
      emoji: '👏',
    });
  }, 10000);

  it('no reenvía un emoji si el ajuste throwEmojis está desactivado', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE', throwEmojis: false },
    });

    const facilitatorSocket = connect();
    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    await once(facilitatorSocket, 'state_sync');

    let received = false;
    facilitatorSocket.on('emoji_thrown', () => {
      received = true;
    });
    facilitatorSocket.emit('emoji_thrown', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      toParticipantId: null,
      emoji: '👏',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).toBe(false);
  }, 10000);
});
