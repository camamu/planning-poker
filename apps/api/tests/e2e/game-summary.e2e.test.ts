import type { GameSummaryView, ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { addIssueOverHttp, createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;

describe('resumen de la sesión por HTTP', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  async function joinRoom(gameId: string, participantId: string): Promise<Socket> {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    const synced = once<EventOf<'state_sync'>>(socket, 'state_sync');
    socket.emit('join', { gameId, participantId });
    await synced;
    return socket;
  }

  it('el payload crudo del resumen no lleva votos ni participantes, ni siquiera con una ronda abierta (invariante 7)', async () => {
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
    const login = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    const payments = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Pagos' });
    const ada = await joinRoom(created.gameId, created.facilitatorId);
    const grace = await joinRoom(created.gameId, joined.participantId);

    const startRound = async (issueId: string): Promise<void> => {
      const started = once<EventOf<'round_started'>>(grace, 'round_started');
      ada.emit('start_round', {
        gameId: created.gameId,
        participantId: created.facilitatorId,
        issueId,
      });
      await started;
    };
    const vote = async (
      who: Socket,
      watcher: Socket,
      participantId: string,
      card: string,
    ): Promise<void> => {
      const voted = once<EventOf<'participant_voted'>>(watcher, 'participant_voted');
      who.emit('vote', { gameId: created.gameId, participantId, card });
      await voted;
    };

    await startRound(login.issueId);
    await vote(ada, grace, created.facilitatorId, '5');
    await vote(grace, ada, joined.participantId, '5');
    const revealed = once<EventOf<'round_revealed'>>(grace, 'round_revealed');
    ada.emit('reveal', { gameId: created.gameId, participantId: created.facilitatorId });
    await revealed;
    const estimated = once<EventOf<'issue_estimated'>>(grace, 'issue_estimated');
    ada.emit('set_estimate', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      card: '5',
    });
    await estimated;

    await startRound(payments.issueId);
    await vote(grace, ada, joined.participantId, '13');

    const response = await fetch(`${server.baseUrl}/api/games/${created.gameId}/summary`);
    const raw = await response.text();

    expect(response.status).toBe(200);
    const summary = JSON.parse(raw) as GameSummaryView;
    expect(summary.totals).toMatchObject({
      estimatedCount: 1,
      pendingCount: 1,
      points: 5,
      voterCount: 2,
    });
    expect(summary.issues.map((issue) => [issue.title, issue.rounds])).toEqual([
      ['Login', 1],
      ['Pagos', 0],
    ]);
    expect(raw).not.toContain('"13"');
    expect(raw).not.toContain(created.facilitatorId);
    expect(raw).not.toContain(joined.participantId);
    expect(raw).not.toContain('participantId');
  }, 10000);

  it('responde 404 al pedir el resumen de una partida que no existe', async () => {
    const response = await fetch(`${server.baseUrl}/api/games/no-existe/summary`);

    expect(response.status).toBe(404);
  });
});
