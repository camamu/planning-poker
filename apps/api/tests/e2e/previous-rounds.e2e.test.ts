import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { addIssueOverHttp, createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;

describe('comparar rondas de la misma tarea en vivo', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function joinRoom(
    gameId: string,
    participantId: string,
  ): Promise<{
    socket: Socket;
    sync: EventOf<'state_sync'>;
  }> {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    const synced = once<EventOf<'state_sync'>>(socket, 'state_sync');
    socket.emit('join', { gameId, participantId });
    return { socket, sync: await synced };
  }

  it('el state_sync con la ronda 2 abierta lleva los votos de la ronda 1 y ningún valor ajeno de la 2 (invariante 7)', async () => {
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
    const issue = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    const ada = await joinRoom(created.gameId, created.facilitatorId);
    const grace = await joinRoom(created.gameId, joined.participantId);

    const emitVote = async (
      who: { socket: Socket },
      watcher: { socket: Socket },
      participantId: string,
      card: string,
    ): Promise<void> => {
      const voted = once<EventOf<'participant_voted'>>(watcher.socket, 'participant_voted');
      who.socket.emit('vote', { gameId: created.gameId, participantId, card });
      await voted;
    };
    const startRound = async (): Promise<void> => {
      const started = once<EventOf<'round_started'>>(grace.socket, 'round_started');
      ada.socket.emit('start_round', {
        gameId: created.gameId,
        participantId: created.facilitatorId,
        issueId: issue.issueId,
      });
      await started;
    };

    await startRound();
    await emitVote(ada, grace, created.facilitatorId, '3');
    await emitVote(grace, ada, joined.participantId, '8');
    const revealed = once<EventOf<'round_revealed'>>(grace.socket, 'round_revealed');
    ada.socket.emit('reveal', { gameId: created.gameId, participantId: created.facilitatorId });
    await revealed;

    await startRound();
    await emitVote(grace, ada, joined.participantId, '13');

    const forAda = (await joinRoom(created.gameId, created.facilitatorId)).sync;
    const forGrace = (await joinRoom(created.gameId, joined.participantId)).sync;

    for (const sync of [forAda, forGrace]) {
      expect(sync.state.currentRound?.status).toBe('OPEN');
      expect(sync.state.currentRound?.roundNumber).toBe(2);
      expect(sync.state.currentRound?.previousRounds).toHaveLength(1);
      expect(sync.state.currentRound?.previousRounds[0]?.votes).toEqual([
        { participantId: created.facilitatorId, card: '3' },
        { participantId: joined.participantId, card: '8' },
      ]);
    }
    expect(JSON.stringify(forAda)).not.toContain('"card":"13"');
    expect(JSON.stringify(forGrace)).toContain('"card":"13"');
  }, 10000);
});
