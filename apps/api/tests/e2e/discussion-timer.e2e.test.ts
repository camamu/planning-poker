import type { EphemeralEvent, ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addIssueOverHttp, createGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;
type EphemeralOf<Type extends EphemeralEvent['type']> = Extract<EphemeralEvent, { type: Type }>;

/**
 * F8 — temporizador de discusión: efímero, en memoria, fuera del agregado `Game` (docs/adr/
 * 0005-extension-de-alcance-bloque-6.md). Este test cubre la gateway directamente: no hay caso
 * de uso que probar por debajo.
 */
describe('temporizador de discusión (F8, efímero)', () => {
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

  it('start reparte el estado del temporizador a toda la room', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckPreset: 'fibonacci',
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
    });
    const issue = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });

    const facilitatorSocket = connect();
    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    await once(facilitatorSocket, 'state_sync');

    const roundStarted = once<EventOf<'round_started'>>(facilitatorSocket, 'round_started');
    facilitatorSocket.emit('start_round', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueId: issue.issueId,
    });
    const { roundId } = await roundStarted;

    const timerSynced = once<EphemeralOf<'discussion_timer_sync'>>(
      facilitatorSocket,
      'discussion_timer_sync',
    );
    facilitatorSocket.emit('discussion_timer_control', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      roundId,
      action: 'start',
      seconds: 180,
    });
    const synced = await timerSynced;

    expect(synced.type).toBe('discussion_timer_sync');
    expect(synced.roundId).toBe(roundId);
    expect(synced.running).toBe(true);
    expect(synced.remainingMs).toBeGreaterThan(179_000);
    expect(synced.remainingMs).toBeLessThanOrEqual(180_000);
  }, 10000);

  it('un participante que se une después recibe el estado vigente del temporizador en el join', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckPreset: 'fibonacci',
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
    });
    const issue = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });

    const facilitatorSocket = connect();
    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    await once(facilitatorSocket, 'state_sync');

    const roundStarted = once<EventOf<'round_started'>>(facilitatorSocket, 'round_started');
    facilitatorSocket.emit('start_round', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueId: issue.issueId,
    });
    const { roundId } = await roundStarted;

    facilitatorSocket.emit('discussion_timer_control', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      roundId,
      action: 'start',
      seconds: 60,
    });
    await once(facilitatorSocket, 'discussion_timer_sync');

    const latecomerSocket = connect();
    const timerOnJoin = once<EphemeralOf<'discussion_timer_sync'>>(
      latecomerSocket,
      'discussion_timer_sync',
    );
    latecomerSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });

    const synced = await timerOnJoin;
    expect(synced.roundId).toBe(roundId);
    expect(synced.running).toBe(true);
  }, 10000);
});
