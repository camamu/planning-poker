import {
  MAX_CARD_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  RATE_LIMITED_CONNECTION_ERROR,
} from '@pp/contracts';
import type { ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { SOCKET_MAX_PAYLOAD_BYTES } from '../../src/infrastructure/realtime/SocketIoGateway.js';
import type { RateLimitPolicy } from '../../src/infrastructure/security/rateLimitPolicy.js';
import { RATE_LIMIT_MESSAGE } from '../../src/infrastructure/security/RateLimiter.js';
import {
  addIssueOverHttp,
  createGameOverHttp,
  getGameStateOverHttp,
} from './support/httpClient.js';
import { once, onceEach } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer, TestServerOptions } from './support/testServer.js';

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;
interface ErrorEvent {
  readonly type: 'error';
  readonly message: string;
}

const MINUTE = 60_000;
const GENEROUS = { limit: 10_000, windowMs: MINUTE };
const perMinute = (limit: number): { limit: number; windowMs: number } => ({
  limit,
  windowMs: MINUTE,
});

interface Tightened {
  readonly joins?: number;
  readonly connections?: number;
  readonly votesPerSocket?: number;
  readonly votesPerParticipant?: number;
}

/** Todo generoso salvo lo que cada test aprieta, para que solo salte el tope que se prueba. */
function policy(tightened: Tightened = {}): RateLimitPolicy {
  return {
    http: {
      perIp: GENEROUS,
      routes:
        tightened.joins === undefined
          ? []
          : [
              {
                method: 'POST',
                url: '/api/games/:id/participants',
                rule: perMinute(tightened.joins),
              },
            ],
    },
    socket: {
      connectionsPerIp: tightened.connections ? perMinute(tightened.connections) : GENEROUS,
      eventsPerSocket: GENEROUS,
      eventRules: tightened.votesPerSocket ? { vote: perMinute(tightened.votesPerSocket) } : {},
      votesPerParticipant: tightened.votesPerParticipant
        ? perMinute(tightened.votesPerParticipant)
        : GENEROUS,
    },
  };
}

describe('endurecimiento: límites de uso, de tamaño y cabeceras (ADR 0031)', () => {
  let server: TestServer | undefined;
  const sockets: Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server?.close();
    server = undefined;
  });

  async function start(options: TestServerOptions = {}): Promise<TestServer> {
    server = await startTestServer(options);
    return server;
  }

  function connect(baseUrl: string, reconnection = true): Socket {
    const socket = connectClient(baseUrl, { transports: ['websocket'], reconnection });
    sockets.push(socket);
    return socket;
  }

  async function createGame(baseUrl: string): Promise<{ gameId: string; facilitatorId: string }> {
    return createGameOverHttp(baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
    });
  }

  /** Una ronda abierta con el facilitador conectado y listo para votar. */
  async function openRound(
    baseUrl: string,
  ): Promise<{ gameId: string; facilitatorId: string; socket: Socket }> {
    const created = await createGame(baseUrl);
    const socket = connect(baseUrl);
    socket.emit('join', { gameId: created.gameId, participantId: created.facilitatorId });
    await once(socket, 'state_sync');

    const issue = await addIssueOverHttp(baseUrl, created.gameId, { title: 'Login' });
    const roundStarted = once<EventOf<'round_started'>>(socket, 'round_started');
    socket.emit('start_round', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueId: issue.issueId,
    });
    await roundStarted;
    return { ...created, socket };
  }

  describe('HTTP', () => {
    it('responde 429 con Retry-After y el mensaje al unirse demasiadas veces desde la misma IP', async () => {
      const { baseUrl } = await start({ rateLimitPolicy: policy({ joins: 3 }) });
      const created = await createGame(baseUrl);
      const join = (): Promise<Response> =>
        fetch(`${baseUrl}/api/games/${created.gameId}/participants`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ displayName: 'Grace', role: 'VOTER' }),
        });

      for (let attempt = 0; attempt < 3; attempt += 1) expect((await join()).status).toBe(201);
      const blocked = await join();

      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await blocked.json()).toEqual({
        error: 'TooManyRequests',
        message: RATE_LIMIT_MESSAGE,
      });
    });

    it('cuenta aparte a cada cliente detrás del proxy de confianza', async () => {
      const { baseUrl } = await start({
        rateLimitPolicy: policy({ joins: 1 }),
        trustedProxyHops: 1,
      });
      const created = await createGame(baseUrl);
      const joinAs = (client: string): Promise<Response> =>
        fetch(`${baseUrl}/api/games/${created.gameId}/participants`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': client },
          body: JSON.stringify({ displayName: 'Grace', role: 'VOTER' }),
        });

      expect((await joinAs('203.0.113.1')).status).toBe(201);
      expect((await joinAs('203.0.113.1')).status).toBe(429);
      expect((await joinAs('203.0.113.2')).status).toBe(201);
    });

    it('rechaza con 400 un nombre de participante de más de MAX_PLAYER_NAME_LENGTH caracteres', async () => {
      const { baseUrl } = await start();
      const created = await createGame(baseUrl);

      const response = await fetch(`${baseUrl}/api/games/${created.gameId}/participants`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'x'.repeat(MAX_PLAYER_NAME_LENGTH + 1),
          role: 'VOTER',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('envía las cabeceras de seguridad y no deja cachear el estado de una partida', async () => {
      const { baseUrl } = await start();
      const created = await createGame(baseUrl);

      const response = await fetch(
        `${baseUrl}/api/games/${created.gameId}?participantId=${created.facilitatorId}`,
      );

      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    });
  });

  describe('Socket.IO', () => {
    it('descarta los votos que pasan del tope del socket y avisa; el último aceptado es el que cuenta', async () => {
      const { baseUrl } = await start({ rateLimitPolicy: policy({ votesPerSocket: 3 }) });
      const { gameId, facilitatorId, socket } = await openRound(baseUrl);

      const accepted = onceEach(socket, 'participant_voted', 3);
      for (const card of ['1', '2', '3'])
        socket.emit('vote', { gameId, participantId: facilitatorId, card });
      await accepted;
      const rejected = once<ErrorEvent>(socket, 'error');
      socket.emit('vote', { gameId, participantId: facilitatorId, card: '5' });

      expect((await rejected).message).toBe(RATE_LIMIT_MESSAGE);
      const state = await getGameStateOverHttp(baseUrl, gameId, facilitatorId);
      expect(state.state.currentRound?.votes).toEqual([
        { participantId: facilitatorId, card: '3' },
      ]);
    });

    it('cuenta los votos de un participante entre todos sus sockets', async () => {
      const { baseUrl } = await start({ rateLimitPolicy: policy({ votesPerParticipant: 2 }) });
      const { gameId, facilitatorId, socket } = await openRound(baseUrl);
      const second = connect(baseUrl);
      second.emit('join', { gameId, participantId: facilitatorId });
      await once(second, 'state_sync');

      const accepted = onceEach(socket, 'participant_voted', 2);
      socket.emit('vote', { gameId, participantId: facilitatorId, card: '1' });
      second.emit('vote', { gameId, participantId: facilitatorId, card: '2' });
      await accepted;
      const rejected = once<ErrorEvent>(second, 'error');
      second.emit('vote', { gameId, participantId: facilitatorId, card: '3' });

      expect((await rejected).message).toBe(RATE_LIMIT_MESSAGE);
    });

    it('rechaza con connect_error la conexión que pasa del tope de la IP', async () => {
      const { baseUrl } = await start({ rateLimitPolicy: policy({ connections: 2 }) });
      await Promise.all(
        [connect(baseUrl), connect(baseUrl)].map((socket) => once(socket, 'connect')),
      );

      const third = connect(baseUrl, false);
      const error = await once<Error>(third, 'connect_error');

      expect(error.message).toBe(RATE_LIMITED_CONNECTION_ERROR);
    });

    it('rechaza con Payload inválido una carta de más de MAX_CARD_LENGTH caracteres', async () => {
      const { baseUrl } = await start();
      const { gameId, facilitatorId, socket } = await openRound(baseUrl);

      const rejected = once<ErrorEvent>(socket, 'error');
      socket.emit('vote', {
        gameId,
        participantId: facilitatorId,
        card: 'x'.repeat(MAX_CARD_LENGTH + 1),
      });

      expect((await rejected).message).toBe('Payload inválido.');
    });

    it('corta la conexión que manda un paquete de más de SOCKET_MAX_PAYLOAD_BYTES', async () => {
      const { baseUrl } = await start();
      const { gameId, facilitatorId, socket } = await openRound(baseUrl);

      const closed = once<string>(socket, 'disconnect');
      socket.emit('vote', {
        gameId,
        participantId: facilitatorId,
        card: 'x'.repeat(SOCKET_MAX_PAYLOAD_BYTES + 1),
      });

      expect(await closed).toBeTypeOf('string');
    });
  });
});
