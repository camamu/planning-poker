import type { AsyncRoundView, GameView, ServerEvent } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { addIssueOverHttp, createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once, onceEach, recordEverything } from './support/socketEvents.js';
import { startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;

/**
 * Todo valor de carta que viaja en un payload: las claves `card`, `ownCard` y `mostVoted`, y las
 * claves de `distribution`, que también delatan lo votado. No se busca el texto suelto porque la
 * baraja entera (`deck.cards`) viaja en cada `state_sync` y contiene todas las cartas posibles.
 */
function cardsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) cardsIn(item, found);
  } else if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) {
      if (
        (key === 'card' || key === 'ownCard' || key === 'mostVoted') &&
        typeof inner === 'string'
      ) {
        found.add(inner);
      } else if (key === 'distribution' && isRecord(inner)) {
        for (const card of Object.keys(inner)) found.add(card);
      } else {
        cardsIn(inner, found);
      }
    }
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeOf(payload: unknown): unknown {
  return typeof payload === 'object' && payload !== null && 'type' in payload
    ? payload.type
    : undefined;
}

describe('votación en diferido (HTTP + WebSocket, tres clientes reales)', () => {
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
  });

  function connect(): { socket: Socket; received: unknown[] } {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    return { socket, received: recordEverything(socket) };
  }

  async function sync(socket: Socket, gameId: string, participantId: string): Promise<GameView> {
    const stateSync = once<EventOf<'state_sync'>>(socket, 'state_sync');
    socket.emit('join', { gameId, participantId });
    return (await stateSync).state;
  }

  it('ningún payload crudo contiene la carta de otro antes del revelado (invariante 7)', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      // Con auto-revelado, para comprobar además que votar en diferido nunca revela.
      settings: { autoReveal: true, whoCanReveal: 'FACILITATOR_ONLY' },
    });
    const grace = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });
    const linus = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Linus',
      role: 'VOTER',
    });
    const login = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    const pagos = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Pagos' });

    const clients = [
      { id: created.facilitatorId, ...connect(), own: new Set(['13', '5']) },
      { id: grace.participantId, ...connect(), own: new Set(['8']) },
      { id: linus.participantId, ...connect(), own: new Set(['2']) },
    ];
    for (const client of clients) await sync(client.socket, created.gameId, client.id);
    const [ada, graceClient, linusClient] = clients;
    if (!ada || !graceClient || !linusClient) throw new Error('faltan clientes');

    // Abrir las dos tareas en diferido.
    const opened = Promise.all(
      clients.map((client) =>
        once<EventOf<'async_rounds_opened'>>(client.socket, 'async_rounds_opened'),
      ),
    );
    ada.socket.emit('open_async_rounds', {
      gameId: created.gameId,
      participantId: ada.id,
      issueIds: [login.issueId, pagos.issueId],
    });
    for (const event of await opened) {
      expect(event.issueIds).toEqual([login.issueId, pagos.issueId]);
    }

    // Cuatro votos: los tres de «Login» y uno de «Pagos».
    const castOnEach = Promise.all(
      clients.map((client) =>
        onceEach<EventOf<'async_vote_cast'>>(client.socket, 'async_vote_cast', 4),
      ),
    );
    const votes = [
      { client: ada, issueId: login.issueId, card: '13' },
      { client: graceClient, issueId: login.issueId, card: '8' },
      { client: linusClient, issueId: login.issueId, card: '2' },
      { client: ada, issueId: pagos.issueId, card: '5' },
    ];
    for (const { client, issueId, card } of votes) {
      client.socket.emit('async_vote', {
        gameId: created.gameId,
        participantId: client.id,
        issueId,
        card,
      });
    }
    for (const events of await castOnEach) {
      expect(JSON.stringify(events)).not.toContain('card');
      expect(events.map((event) => event.issueId).sort()).toEqual(
        [login.issueId, login.issueId, login.issueId, pagos.issueId].sort(),
      );
    }

    // Una foto fresca del estado por cliente, como la que pide el front tras reconectar o resincronizar.
    const states = await Promise.all(
      clients.map((client) => sync(client.socket, created.gameId, client.id)),
    );
    // Lo decisivo: el payload crudo de cada socket, no la UI.
    for (const client of clients) {
      const seen = cardsIn(client.received);
      expect([...seen].filter((card) => !client.own.has(card))).toEqual([]);
    }
    const eventTypes = clients.flatMap((client) => client.received.map(typeOf));
    expect(eventTypes).not.toContain('round_revealed');
    expect(eventTypes).not.toContain('async_rounds_revealed');

    const loginRound = (state: GameView): AsyncRoundView | undefined =>
      state.asyncRounds.find((round) => round.issueId === login.issueId);

    for (const state of states) {
      expect(loginRound(state)?.status).toBe('OPEN');
      expect(loginRound(state)?.voterIds).toHaveLength(3);
      expect(loginRound(state)?.votes).toEqual([]);
      expect(loginRound(state)?.result).toBeNull();
    }
    const [, graceState] = states;
    expect(graceState && loginRound(graceState)?.ownCard).toBe('8');

    // Tras revelar sí se ven todas las cartas, y las dos tareas con votos se revelan juntas.
    const revealedOnEach = Promise.all(
      clients.map((client) =>
        once<EventOf<'async_rounds_revealed'>>(client.socket, 'async_rounds_revealed'),
      ),
    );
    ada.socket.emit('reveal_async', { gameId: created.gameId, participantId: ada.id });
    for (const event of await revealedOnEach) {
      expect([...event.issueIds].sort()).toEqual([login.issueId, pagos.issueId].sort());
      expect(JSON.stringify(event)).not.toContain('card');
    }

    const afterReveal = await sync(linusClient.socket, created.gameId, linusClient.id);
    const revealedLogin = loginRound(afterReveal);
    expect(revealedLogin?.status).toBe('REVEALED');
    expect(new Set(revealedLogin?.votes.map((vote) => vote.card))).toEqual(
      new Set(['13', '8', '2']),
    );
    expect(revealedLogin?.result?.distribution).toEqual({ '13': 1, '8': 1, '2': 1 });
  });

  it('se estima una tarea revelada en diferido sin pasarla por la mesa', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
    });
    const login = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    const { socket } = connect();
    await sync(socket, created.gameId, created.facilitatorId);

    socket.emit('open_async_rounds', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueIds: [login.issueId],
    });
    await once<EventOf<'async_rounds_opened'>>(socket, 'async_rounds_opened');
    socket.emit('async_vote', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueId: login.issueId,
      card: '5',
    });
    await once<EventOf<'async_vote_cast'>>(socket, 'async_vote_cast');
    socket.emit('reveal_async', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueIds: [login.issueId],
    });
    await once<EventOf<'async_rounds_revealed'>>(socket, 'async_rounds_revealed');

    socket.emit('set_estimate', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      card: '5',
      issueId: login.issueId,
    });
    const estimated = await once<EventOf<'issue_estimated'>>(socket, 'issue_estimated');
    const state = await sync(socket, created.gameId, created.facilitatorId);

    expect(estimated).toMatchObject({ issueId: login.issueId, finalEstimate: '5' });
    expect(state.currentRound).toBeNull();
    expect(state.asyncRounds).toEqual([]);
    expect(state.issues[0]).toMatchObject({ status: 'ESTIMATED', finalEstimate: '5' });
  });

  it('quien no puede revelar recibe un error y la ronda sigue abierta', async () => {
    const created = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
    });
    const grace = await joinGameOverHttp(server.baseUrl, created.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });
    const login = await addIssueOverHttp(server.baseUrl, created.gameId, { title: 'Login' });
    const facilitator = connect();
    const voter = connect();
    await sync(facilitator.socket, created.gameId, created.facilitatorId);
    await sync(voter.socket, created.gameId, grace.participantId);
    facilitator.socket.emit('open_async_rounds', {
      gameId: created.gameId,
      participantId: created.facilitatorId,
      issueIds: [login.issueId],
    });
    await once<EventOf<'async_rounds_opened'>>(voter.socket, 'async_rounds_opened');
    voter.socket.emit('async_vote', {
      gameId: created.gameId,
      participantId: grace.participantId,
      issueId: login.issueId,
      card: '8',
    });
    await once<EventOf<'async_vote_cast'>>(voter.socket, 'async_vote_cast');

    const rejected = once<{ type: 'error'; message: string }>(voter.socket, 'error');
    voter.socket.emit('reveal_async', {
      gameId: created.gameId,
      participantId: grace.participantId,
    });
    expect((await rejected).message).toContain('no tiene permiso para revelar');

    const state = await sync(voter.socket, created.gameId, grace.participantId);
    expect(state.asyncRounds[0]?.status).toBe('OPEN');
  });
});
