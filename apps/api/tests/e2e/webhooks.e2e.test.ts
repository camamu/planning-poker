import { webhookEnvelopeSchema } from '@pp/contracts';
import type { ServerEvent, WebhookEnvelope } from '@pp/contracts';
import { io as connectClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { createGameOverHttp, joinGameOverHttp } from './support/httpClient.js';
import { once } from './support/socketEvents.js';
import { TEST_WEB_BASE_URL, startTestServer } from './support/testServer.js';
import type { TestServer } from './support/testServer.js';
import {
  TEST_HOOK_ORIGIN,
  hasValidSignature,
  senderTo,
  startReceiver,
} from './support/webhookReceiver.js';
import type { Delivery, Receiver } from './support/webhookReceiver.js';

interface CreatedTeam {
  readonly team: z.infer<typeof teamSchema>;
  readonly created: { status: number; json: unknown };
  readonly webhook: z.infer<typeof createdWebhookSchema>;
}

interface TeamGame {
  readonly game: { gameId: string; facilitatorId: string };
  readonly grace: { participantId: string };
}

type EventOf<Type extends ServerEvent['type']> = Extract<ServerEvent, { type: Type }>;

const teamSchema = z.object({ slug: z.string(), token: z.string() });
const createdWebhookSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  secret: z.string(),
  secretHint: z.string(),
});
const listedWebhookSchema = z.array(
  z.object({
    id: z.string(),
    url: z.string(),
    events: z.array(z.string()),
    secretHint: z.string(),
  }),
);
const testResultSchema = z.object({
  ok: z.boolean(),
  status: z.number().nullable(),
  error: z.string().nullable(),
});
const sendResultSchema = z.object({ delivered: z.number(), failed: z.number() });
const summarySchema = z.object({ canSendToTeam: z.boolean() });
const importedSchema = z.object({ issueIds: z.array(z.string()) });

describe('webhooks salientes (HTTP + WebSocket + receptor local)', () => {
  let receiver: Receiver;
  let server: TestServer;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    receiver = await startReceiver();
    server = await startTestServer({ webhookSender: senderTo(receiver) });
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await server.close();
    await receiver.close();
  });

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${server.baseUrl}${path}`, {
      method,
      // Fastify rechaza con 400 un `content-type: application/json` sin cuerpo.
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, json: text === '' ? null : JSON.parse(text) };
  }

  async function createTeam(events: ReadonlyArray<string>): Promise<CreatedTeam> {
    const team = teamSchema.parse((await request('POST', '/api/teams', { name: 'Backend' })).json);
    const created = await request('POST', `/api/teams/${team.slug}/webhooks?k=${team.token}`, {
      url: `${TEST_HOOK_ORIGIN}/entrada`,
      events,
    });
    return { team, created, webhook: createdWebhookSchema.parse(created.json) };
  }

  async function createTeamGame(slug: string): Promise<TeamGame> {
    const game = await createGameOverHttp(server.baseUrl, {
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
      teamSlug: slug,
    });
    const grace = await joinGameOverHttp(server.baseUrl, game.gameId, {
      displayName: 'Grace',
      role: 'VOTER',
    });
    return { game, grace };
  }

  function connect(): Socket {
    const socket = connectClient(server.baseUrl, { transports: ['websocket'] });
    sockets.push(socket);
    return socket;
  }

  async function joinRoom(socket: Socket, gameId: string, participantId: string): Promise<void> {
    const synced = once<EventOf<'state_sync'>>(socket, 'state_sync');
    socket.emit('join', { gameId, participantId });
    await synced;
  }

  /** Importa una tarea con enlace, la vota entre dos y la deja revelada, a punto de estimar. */
  async function revealedTask(
    socket: Socket,
    gameId: string,
    facilitatorId: string,
    graceId: string,
  ): Promise<string> {
    const imported = importedSchema.parse(
      (
        await request('POST', `/api/games/${gameId}/issues/batch`, {
          issues: [{ title: 'Login', externalUrl: 'https://acme.atlassian.net/browse/ABC-123' }],
        })
      ).json,
    );
    const issueId = imported.issueIds[0] ?? '';
    const started = once<EventOf<'round_started'>>(socket, 'round_started');
    socket.emit('start_round', { gameId, participantId: facilitatorId, issueId });
    await started;
    const voted = once<EventOf<'round_revealed'>>(socket, 'round_revealed');
    socket.emit('vote', { gameId, participantId: facilitatorId, card: '5' });
    socket.emit('vote', { gameId, participantId: graceId, card: '8' });
    socket.emit('reveal', { gameId, participantId: facilitatorId });
    await voted;
    return issueId;
  }

  function bodyOf(delivery: Delivery): WebhookEnvelope {
    return webhookEnvelopeSchema.parse(JSON.parse(delivery.body));
  }

  it('estimar una tarea en una partida de equipo llega a un receptor local con firma válida', async () => {
    const { team, webhook } = await createTeam(['issue.estimated']);
    const { game, grace } = await createTeamGame(team.slug);
    const socket = connect();
    await joinRoom(socket, game.gameId, game.facilitatorId);
    const issueId = await revealedTask(
      socket,
      game.gameId,
      game.facilitatorId,
      grace.participantId,
    );
    receiver.deliveries.length = 0;

    const estimated = once<EventOf<'issue_estimated'>>(socket, 'issue_estimated');
    socket.emit('set_estimate', {
      gameId: game.gameId,
      participantId: game.facilitatorId,
      card: '5',
    });
    await estimated;

    await expect.poll(() => receiver.deliveries.length).toBe(1);
    const [delivery] = receiver.deliveries;
    if (!delivery) throw new Error('no ha llegado ninguna entrega');
    expect(delivery.path).toBe('/entrada');
    expect(hasValidSignature(delivery, webhook.secret)).toBe(true);
    expect(hasValidSignature(delivery, 'otro-secreto')).toBe(false);
    expect(delivery.headers['x-pp-event']).toBe('issue.estimated');
    expect(delivery.headers['content-type']).toBe('application/json');
    const body = bodyOf(delivery);
    expect(delivery.headers['x-pp-delivery']).toBe(body.deliveryId);
    expect(body).toMatchObject({
      version: 1,
      event: 'issue.estimated',
      team: { slug: team.slug, name: 'Backend' },
      game: {
        id: game.gameId,
        name: 'Sprint 42',
        url: `${TEST_WEB_BASE_URL}/games/${game.gameId}`,
      },
      data: {
        issueId,
        title: 'Login',
        key: 'ABC-123',
        externalUrl: 'https://acme.atlassian.net/browse/ABC-123',
        finalEstimate: '5',
        numericEstimate: 5,
        rounds: 1,
      },
    });
  });

  it('el cuerpo de la estimación no contiene los votos de nadie', async () => {
    const { team } = await createTeam(['issue.estimated']);
    const { game, grace } = await createTeamGame(team.slug);
    const socket = connect();
    await joinRoom(socket, game.gameId, game.facilitatorId);
    await revealedTask(socket, game.gameId, game.facilitatorId, grace.participantId);
    receiver.deliveries.length = 0;

    const estimated = once<EventOf<'issue_estimated'>>(socket, 'issue_estimated');
    socket.emit('set_estimate', {
      gameId: game.gameId,
      participantId: game.facilitatorId,
      card: '5',
    });
    await estimated;
    await expect.poll(() => receiver.deliveries.length).toBe(1);

    const raw = receiver.deliveries[0]?.body ?? '';
    expect(raw).not.toContain(game.facilitatorId);
    expect(raw).not.toContain(grace.participantId);
    expect(raw).not.toContain('"votes"');
    expect(raw).not.toContain('"card"');
  });

  it('importar tareas en una partida de equipo envía issues.imported', async () => {
    const { team, webhook } = await createTeam(['issues.imported']);
    const { game } = await createTeamGame(team.slug);

    await request('POST', `/api/games/${game.gameId}/issues/batch`, {
      issues: [
        { title: 'Login', externalUrl: 'https://acme.atlassian.net/browse/ABC-1' },
        { title: 'Pagos' },
      ],
    });

    await expect.poll(() => receiver.deliveries.length).toBe(1);
    const [delivery] = receiver.deliveries;
    if (!delivery) throw new Error('no ha llegado ninguna entrega');
    expect(hasValidSignature(delivery, webhook.secret)).toBe(true);
    const body = bodyOf(delivery);
    expect(body.event === 'issues.imported' && body.data.issues.map((issue) => issue.key)).toEqual([
      'ABC-1',
      null,
    ]);
  });

  it('una partida sin equipo no envía nada', async () => {
    await createTeam(['issues.imported', 'issue.estimated']);
    const game = await createGameOverHttp(server.baseUrl, {
      name: 'Sin equipo',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      facilitatorName: 'Ada',
      settings: { autoReveal: false, whoCanReveal: 'ANYONE' },
    });

    await request('POST', `/api/games/${game.gameId}/issues/batch`, {
      issues: [{ title: 'Login' }],
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(receiver.deliveries).toEqual([]);
  });

  it('«Enviar prueba» entrega un ping y devuelve el código del receptor', async () => {
    const { team, webhook } = await createTeam(['issue.estimated']);

    const result = await request(
      'POST',
      `/api/teams/${team.slug}/webhooks/${webhook.id}/test?k=${team.token}`,
    );

    expect(testResultSchema.parse(result.json)).toEqual({ ok: true, status: 200, error: null });
    const [delivery] = receiver.deliveries;
    if (!delivery) throw new Error('no ha llegado ninguna entrega');
    expect(hasValidSignature(delivery, webhook.secret)).toBe(true);
    expect(delivery.headers['x-pp-event']).toBe('ping');
    expect(bodyOf(delivery)).toMatchObject({
      event: 'ping',
      game: null,
      team: { slug: team.slug },
    });
  });

  it('«Enviar prueba» cuenta como fallo un receptor que contesta 500, sin reintentar', async () => {
    const { team, webhook } = await createTeam(['issue.estimated']);
    receiver.respondWith(500);

    const result = await request(
      'POST',
      `/api/teams/${team.slug}/webhooks/${webhook.id}/test?k=${team.token}`,
    );

    expect(testResultSchema.parse(result.json)).toMatchObject({ ok: false, status: 500 });
    expect(receiver.deliveries).toHaveLength(1);
  });

  it('«Enviar resumen» entrega el resumen y la página sabe que puede enviarlo', async () => {
    const { team, webhook } = await createTeam(['session.summary']);
    const { game, grace } = await createTeamGame(team.slug);
    const summaryBefore = await request('GET', `/api/games/${game.gameId}/summary`);
    expect(summarySchema.parse(summaryBefore.json).canSendToTeam).toBe(true);

    const result = await request('POST', `/api/games/${game.gameId}/summary/webhook`, {
      participantId: grace.participantId,
    });

    expect(sendResultSchema.parse(result.json)).toEqual({ delivered: 1, failed: 0 });
    const [delivery] = receiver.deliveries;
    if (!delivery) throw new Error('no ha llegado ninguna entrega');
    expect(hasValidSignature(delivery, webhook.secret)).toBe(true);
    expect(bodyOf(delivery)).toMatchObject({
      event: 'session.summary',
      data: { id: game.gameId, name: 'Sprint 42' },
    });
  });

  it('solo quien está en la partida puede enviar el resumen', async () => {
    const { team } = await createTeam(['session.summary']);
    const { game } = await createTeamGame(team.slug);

    const result = await request('POST', `/api/games/${game.gameId}/summary/webhook`, {
      participantId: 'desconocido',
    });

    expect(result.status).toBe(422);
    expect(receiver.deliveries).toEqual([]);
  });

  it('con el receptor caído la estimación se guarda y la sala recibe webhook_failed', async () => {
    const { team } = await createTeam(['issue.estimated']);
    const { game, grace } = await createTeamGame(team.slug);
    const socket = connect();
    await joinRoom(socket, game.gameId, game.facilitatorId);
    const issueId = await revealedTask(
      socket,
      game.gameId,
      game.facilitatorId,
      grace.participantId,
    );
    receiver.respondWith(503);
    receiver.deliveries.length = 0;

    const estimated = once<EventOf<'issue_estimated'>>(socket, 'issue_estimated');
    const failed = once<{ type: 'webhook_failed'; event: string; issueId: string | null }>(
      socket,
      'webhook_failed',
    );
    socket.emit('set_estimate', {
      gameId: game.gameId,
      participantId: game.facilitatorId,
      card: '5',
    });

    expect((await estimated).finalEstimate).toBe('5');
    expect(await failed).toEqual({ type: 'webhook_failed', event: 'issue.estimated', issueId });
    // 1 entrega + 3 reintentos, y la estimación sigue ahí.
    expect(receiver.deliveries).toHaveLength(4);
    const synced = once<EventOf<'state_sync'>>(socket, 'state_sync');
    socket.emit('join', { gameId: game.gameId, participantId: game.facilitatorId });
    const { state } = await synced;
    expect(state.issues[0]).toMatchObject({ status: 'ESTIMATED', finalEstimate: '5' });
  });
});

describe('gestión de webhooks por HTTP', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${server.baseUrl}${path}`, {
      method,
      // Fastify rechaza con 400 un `content-type: application/json` sin cuerpo.
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, json: text === '' ? null : JSON.parse(text) };
  }

  async function newTeam(): Promise<{ slug: string; token: string }> {
    return teamSchema.parse((await request('POST', '/api/teams', { name: 'Backend' })).json);
  }

  const valid = { url: 'https://hooks.example/entrada', events: ['issue.estimated'] };

  it('el alta devuelve el secreto y el listado solo enseña su final', async () => {
    const team = await newTeam();
    const path = `/api/teams/${team.slug}/webhooks?k=${team.token}`;

    const created = await request('POST', path, valid);
    const listed = await request('GET', path);

    expect(created.status).toBe(201);
    const webhook = createdWebhookSchema.parse(created.json);
    expect(webhook.secret).toHaveLength(64);
    const [item] = listedWebhookSchema.parse(listed.json);
    expect(item).toEqual({
      id: webhook.id,
      url: valid.url,
      events: valid.events,
      secretHint: webhook.secret.slice(-4),
    });
    expect(JSON.stringify(listed.json)).not.toContain(webhook.secret);
  });

  it('rechaza una URL http, una lista de eventos vacía y un evento desconocido con un 400', async () => {
    const team = await newTeam();
    const path = `/api/teams/${team.slug}/webhooks?k=${team.token}`;

    for (const body of [
      { ...valid, url: 'http://hooks.example/entrada' },
      { ...valid, events: [] },
      { ...valid, events: ['ping'] },
    ]) {
      expect((await request('POST', path, body)).status).toBe(400);
    }
  });

  it('el cuarto webhook de un equipo se rechaza con un 422', async () => {
    const team = await newTeam();
    const path = `/api/teams/${team.slug}/webhooks?k=${team.token}`;
    for (const index of [1, 2, 3]) {
      await request('POST', path, { ...valid, url: `https://hooks.example/${index.toString()}` });
    }

    const fourth = await request('POST', path, valid);

    expect(fourth.status).toBe(422);
  });

  it('exige el token del equipo y devuelve 404 si no es el suyo', async () => {
    const team = await newTeam();

    expect((await request('GET', `/api/teams/${team.slug}/webhooks?k=otro`)).status).toBe(404);
    expect((await request('POST', `/api/teams/${team.slug}/webhooks?k=otro`, valid)).status).toBe(
      404,
    );
    expect((await request('GET', `/api/teams/${team.slug}/webhooks`)).status).toBe(400);
  });

  it('borrar un webhook lo quita del listado y borrar uno que no existe da 404', async () => {
    const team = await newTeam();
    const path = `/api/teams/${team.slug}/webhooks`;
    const created = createdWebhookSchema.parse(
      (await request('POST', `${path}?k=${team.token}`, valid)).json,
    );

    const removed = await request('DELETE', `${path}/${created.id}?k=${team.token}`);
    const again = await request('DELETE', `${path}/${created.id}?k=${team.token}`);
    const listed = await request('GET', `${path}?k=${team.token}`);

    expect(removed.status).toBe(204);
    expect(again.status).toBe(404);
    expect(listedWebhookSchema.parse(listed.json)).toEqual([]);
  });
});
