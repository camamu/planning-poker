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

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;

describe('partida en vivo (HTTP + WebSocket, dos clientes reales)', () => {
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

  it('crea, une, vota y revela sin filtrar el voto ajeno antes del reveal (invariante 7)', async () => {
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

    const facilitatorSocket = connect();
    const voterSocket = connect();

    facilitatorSocket.emit('join', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    voterSocket.emit('join', { gameId: created.gameId, participantId: joined.participantId });
    await Promise.all([
      once<EventOf<'state_sync'>>(facilitatorSocket, 'state_sync'),
      once<EventOf<'state_sync'>>(voterSocket, 'state_sync'),
    ]);

    const issueAddedOnVoter = once<EventOf<'issue_added'>>(voterSocket, 'issue_added');
    const issue = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    expect((await issueAddedOnVoter).issueId).toBe(issue.issueId);

    const roundStartedOnVoter = once<EventOf<'round_started'>>(voterSocket, 'round_started');
    facilitatorSocket.emit('start_round', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueId: issue.issueId,
    });
    const roundStarted = await roundStartedOnVoter;

    // Invariante 7: el resto de participantes solo ven `hasVoted`, nunca la carta, antes del reveal.
    const facilitatorVoted = once<EventOf<'participant_voted'>>(voterSocket, 'participant_voted');
    facilitatorSocket.emit('vote', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      card: '5',
    });
    const facilitatorVotedPayload = await facilitatorVoted;
    expect(facilitatorVotedPayload).toEqual({
      type: 'participant_voted',
      version: expect.any(Number) as number,
      roundId: roundStarted.roundId,
      participantId: created.facilitatorId,
    });
    expect(JSON.stringify(facilitatorVotedPayload)).not.toContain('card');

    const voterVoted = once<EventOf<'participant_voted'>>(facilitatorSocket, 'participant_voted');
    voterSocket.emit('vote', {
      gameId: created.gameId,
      participantId: joined.participantId,
      card: '8',
    });
    await voterVoted;

    const revealedOnFacilitator = once<EventOf<'round_revealed'>>(
      facilitatorSocket,
      'round_revealed',
    );
    const revealedOnVoter = once<EventOf<'round_revealed'>>(voterSocket, 'round_revealed');
    facilitatorSocket.emit('reveal', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
    });
    const [forFacilitator, forVoter] = await Promise.all([revealedOnFacilitator, revealedOnVoter]);

    for (const revealed of [forFacilitator, forVoter]) {
      const cards = new Set(revealed.votes.map((vote) => vote.card));
      expect(cards).toEqual(new Set(['5', '8']));
      expect(revealed.result.average).toBe(6.5);
      expect(revealed.result.isUnanimous).toBe(false);
    }

    const stateForVoter = await getGameStateOverHttp(
      server.baseUrl,
      created.gameId,
      joined.participantId,
    );
    expect(stateForVoter.state.currentRound?.status).toBe('REVEALED');
    expect(new Set(stateForVoter.state.currentRound?.votes.map((vote) => vote.card))).toEqual(
      new Set(['5', '8']),
    );
  }, 10000);
});
