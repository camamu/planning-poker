import { describe, expect, it } from 'vitest';
import type { EventPublisher } from '../../src/application/ports/EventPublisher.js';
import { AddWebhook } from '../../src/application/use-cases/AddWebhook.js';
import { CreateGame } from '../../src/application/use-cases/CreateGame.js';
import type { CreateGameResult } from '../../src/application/use-cases/CreateGame.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import type { CreateTeamResult } from '../../src/application/use-cases/CreateTeam.js';
import { DispatchWebhooks } from '../../src/application/use-cases/DispatchWebhooks.js';
import { GetGameSummary } from '../../src/application/use-cases/GetGameSummary.js';
import { ImportIssues } from '../../src/application/use-cases/ImportIssues.js';
import { ListWebhooks } from '../../src/application/use-cases/ListWebhooks.js';
import { RemoveWebhook } from '../../src/application/use-cases/RemoveWebhook.js';
import { SendSessionSummary } from '../../src/application/use-cases/SendSessionSummary.js';
import { SetFinalEstimate } from '../../src/application/use-cases/SetFinalEstimate.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { TestWebhook } from '../../src/application/use-cases/TestWebhook.js';
import { SYSTEM_DECK_IDS } from '../../src/domain/deck/SavedDeck.js';
import { ParticipantNotFoundError } from '../../src/domain/game/Game.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { TeamId } from '../../src/domain/team/TeamId.js';
import { TooManyWebhooksError, WebhookNotFoundError } from '../../src/domain/team/Team.js';
import { WebhookNeedsEventsError } from '../../src/domain/team/Webhook.js';
import { InsecureWebhookUrlError } from '../../src/domain/team/WebhookUrl.js';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { StartVotingRound } from '../../src/application/use-cases/StartVotingRound.js';
import { makeContext } from './support/context.js';
import type { UseCaseContext } from './support/context.js';
import { RecordingBroadcaster } from './support/RecordingBroadcaster.js';
import { FAILED_DELIVERY, RecordingWebhookSender } from './support/RecordingWebhookSender.js';
import { SequentialSecretGenerator } from './support/SequentialSecretGenerator.js';

const WEB = 'https://pp.example';
type Events = ReadonlyArray<'issue.estimated' | 'issues.imported' | 'session.summary'>;

interface Harness {
  readonly context: UseCaseContext;
  readonly broadcaster: RecordingBroadcaster;
  readonly sender: RecordingWebhookSender;
  readonly dispatch: DispatchWebhooks;
  readonly secrets: SequentialSecretGenerator;
  seedTeam: (webhooks?: ReadonlyArray<Events>) => Promise<CreateTeamResult>;
  seedGame: (teamSlug?: string) => Promise<CreateGameResult>;
  /** Una tarea con ronda revelada y sin estimar, en la partida indicada. */
  revealedIssue: (gameId: string, facilitatorId: string) => Promise<string>;
  /** Acepta la estimación publicando también a los webhooks, como lo hace el publicador compuesto. */
  estimate: (gameId: string, facilitatorId: string) => Promise<void>;
}

function setup(sender = new RecordingWebhookSender()): Harness {
  const context = makeContext();
  const broadcaster = new RecordingBroadcaster();
  const secrets = new SequentialSecretGenerator();
  const dispatch = new DispatchWebhooks(
    context.games,
    context.teams,
    sender,
    broadcaster,
    context.ids,
    WEB,
  );
  // Como el publicador compuesto de infraestructura, pero esperando a los webhooks para poder comprobarlos.
  const events: EventPublisher = {
    publishAll: async (published) => {
      await context.events.publishAll(published);
      await dispatch.publishAll(published);
    },
  };
  const addWebhook = new AddWebhook(context.teams, context.hasher, context.ids, secrets);

  async function seedTeam(webhooks: ReadonlyArray<Events> = []): Promise<CreateTeamResult> {
    const team = await new CreateTeam(context.teams, context.hasher, context.ids).execute({
      name: 'Backend',
    });
    for (const [index, subscribed] of webhooks.entries()) {
      await addWebhook.execute({
        slug: team.slug,
        token: team.token,
        url: `https://hooks.example/${index.toString()}`,
        events: subscribed,
      });
    }
    return team;
  }

  async function seedGame(teamSlug?: string): Promise<CreateGameResult> {
    const created = await new CreateGame(
      context.games,
      context.decks,
      context.teams,
      context.events,
      context.clock,
      context.ids,
    ).execute({
      name: 'Sprint 42',
      deckId: SYSTEM_DECK_IDS.fibonacci.value,
      settings: { autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' },
      facilitatorName: 'Ada',
      teamSlug,
    });
    context.events.clear();
    return created;
  }

  /** Abre una ronda sobre una tarea nueva, vota, revela y devuelve el id de la tarea sin estimarla. */
  async function revealedIssue(gameId: string, facilitatorId: string): Promise<string> {
    const [issueId] = await new ImportIssues(
      context.games,
      context.events,
      context.clock,
      context.ids,
    ).execute({
      gameId,
      issues: [{ title: 'Login', externalUrl: 'https://acme.atlassian.net/browse/ABC-123' }],
    });
    if (!issueId) throw new Error('no se ha creado la tarea');
    await new StartVotingRound(context.games, context.events, context.clock, context.ids).execute({
      gameId,
      issueId,
    });
    await new CastVote(context.games, context.events, context.clock).execute({
      gameId,
      participantId: facilitatorId,
      card: '5',
    });
    await new RevealRound(context.games, context.events, context.clock).execute({
      gameId,
      participantId: facilitatorId,
    });
    return issueId;
  }

  const estimate = (gameId: string, facilitatorId: string): Promise<void> =>
    new SetFinalEstimate(context.games, events, context.clock).execute({
      gameId,
      participantId: facilitatorId,
      card: '5',
    });

  return {
    context,
    broadcaster,
    sender,
    dispatch,
    secrets,
    seedTeam,
    seedGame,
    revealedIssue,
    estimate,
  };
}

describe('DispatchWebhooks', () => {
  it('no envía webhooks de una partida sin equipo', async () => {
    const { sender, seedTeam, seedGame, revealedIssue, estimate } = setup();
    await seedTeam([['issue.estimated']]);
    const game = await seedGame();
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(sender.sent).toEqual([]);
  });

  it('envía issue.estimated al webhook del equipo al aceptar la estimación', async () => {
    const { sender, seedTeam, seedGame, revealedIssue, estimate } = setup();
    const team = await seedTeam([['issue.estimated']]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(sender.sent).toHaveLength(1);
    const [body] = sender.bodies();
    expect(body).toMatchObject({
      event: 'issue.estimated',
      team: { slug: team.slug },
      data: { key: 'ABC-123', finalEstimate: '5', numericEstimate: 5, rounds: 1 },
    });
    expect(sender.sent[0]?.request.url).toBe('https://hooks.example/0');
    expect(sender.sent[0]?.options).toEqual({ retry: true });
  });

  it('solo envía a los webhooks suscritos al evento', async () => {
    const { sender, seedTeam, seedGame, revealedIssue, estimate } = setup();
    const team = await seedTeam([
      ['issue.estimated'],
      ['issues.imported', 'session.summary'],
      ['issue.estimated', 'session.summary'],
    ]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(sender.sent.map(({ request }) => request.url).sort()).toEqual([
      'https://hooks.example/0',
      'https://hooks.example/2',
    ]);
  });

  it('cada webhook recibe un identificador de entrega distinto y la firma con su propio secreto', async () => {
    const { sender, seedTeam, seedGame, revealedIssue, estimate } = setup();
    const team = await seedTeam([['issue.estimated'], ['issue.estimated']]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    const deliveries = sender.sent.map(({ request }) => request.deliveryId);
    expect(new Set(deliveries).size).toBe(2);
    expect(new Set(sender.sent.map(({ request }) => request.secret)).size).toBe(2);
  });

  it('envía issues.imported al importar tareas en una partida de equipo', async () => {
    const { sender, context, seedTeam, seedGame, dispatch } = setup();
    const team = await seedTeam([['issues.imported']]);
    const game = await seedGame(team.slug);
    const importIssues = new ImportIssues(
      context.games,
      context.events,
      context.clock,
      context.ids,
    );
    await importIssues.execute({
      gameId: game.gameId,
      issues: [
        { title: 'Login' },
        { title: 'Pagos', externalUrl: 'https://x.example/browse/AB-2' },
      ],
    });

    await dispatch.publishAll(context.events.published);

    const [body] = sender.bodies();
    expect(body).toMatchObject({ event: 'issues.imported' });
    expect(body?.event === 'issues.imported' && body.data.issues.map((issue) => issue.key)).toEqual(
      [null, 'AB-2'],
    );
  });

  it('ignora los eventos que no son suyos', async () => {
    const { sender, context, seedTeam, seedGame, dispatch } = setup();
    const team = await seedTeam([['issue.estimated', 'issues.imported']]);
    const game = await seedGame(team.slug);
    await new ImportIssues(context.games, context.events, context.clock, context.ids).execute({
      gameId: game.gameId,
      issues: [{ title: 'Login' }],
    });
    context.events.clear();
    const [issueId] = (await context.games.findById(GameId.of(game.gameId)))?.allIssues() ?? [];
    if (!issueId) throw new Error('falta la tarea');
    await new StartVotingRound(context.games, context.events, context.clock, context.ids).execute({
      gameId: game.gameId,
      issueId: issueId.id.value,
    });
    await new CastVote(context.games, context.events, context.clock).execute({
      gameId: game.gameId,
      participantId: game.facilitatorId,
      card: '5',
    });

    await dispatch.publishAll(context.events.published);

    expect(context.events.published.map((event) => event.type)).toEqual([
      'VotingRoundStarted',
      'VoteCast',
    ]);
    expect(sender.sent).toEqual([]);
  });

  it('un fallo de entrega no deshace la estimación y avisa a la sala', async () => {
    const sender = new RecordingWebhookSender(() => FAILED_DELIVERY);
    const { context, broadcaster, seedTeam, seedGame, revealedIssue, estimate } = setup(sender);
    const team = await seedTeam([['issue.estimated']]);
    const game = await seedGame(team.slug);
    const issueId = await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    const stored = await context.games.findById(GameId.of(game.gameId));
    expect(stored?.findIssue(IssueId.of(issueId))?.currentStatus()).toBe('ESTIMATED');
    expect(broadcaster.notifications).toEqual([
      {
        gameId: game.gameId,
        event: { type: 'webhook_failed', event: 'issue.estimated', issueId },
      },
    ]);
  });

  it('avisa una vez por cada webhook que falla y ninguna por los que llegan', async () => {
    const sender = new RecordingWebhookSender((request) =>
      request.url.endsWith('/1') ? FAILED_DELIVERY : { delivered: true, status: 200, attempts: 1 },
    );
    const { broadcaster, seedTeam, seedGame, revealedIssue, estimate } = setup(sender);
    const team = await seedTeam([['issue.estimated'], ['issue.estimated'], ['issue.estimated']]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(sender.sent).toHaveLength(3);
    expect(broadcaster.notifications).toHaveLength(1);
  });

  it('no avisa a la sala cuando todas las entregas llegan', async () => {
    const { broadcaster, seedTeam, seedGame, revealedIssue, estimate } = setup();
    const team = await seedTeam([['issue.estimated']]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(broadcaster.notifications).toEqual([]);
  });

  it('un issues.imported fallido avisa sin tarea concreta', async () => {
    const sender = new RecordingWebhookSender(() => FAILED_DELIVERY);
    const { context, broadcaster, seedTeam, seedGame, dispatch } = setup(sender);
    const team = await seedTeam([['issues.imported']]);
    const game = await seedGame(team.slug);
    await new ImportIssues(context.games, context.events, context.clock, context.ids).execute({
      gameId: game.gameId,
      issues: [{ title: 'Login' }],
    });

    await dispatch.publishAll(context.events.published);

    expect(broadcaster.notifications.map(({ event }) => event)).toEqual([
      { type: 'webhook_failed', event: 'issues.imported', issueId: null },
    ]);
  });

  it('no hace nada si el equipo ya no tiene webhooks suscritos', async () => {
    const { sender, seedTeam, seedGame, revealedIssue, estimate } = setup();
    const team = await seedTeam([['session.summary']]);
    const game = await seedGame(team.slug);
    await revealedIssue(game.gameId, game.facilitatorId);

    await estimate(game.gameId, game.facilitatorId);

    expect(sender.sent).toEqual([]);
  });
});

describe('SendSessionSummary', () => {
  function sendSummary(s: Harness, sender = s.sender): SendSessionSummary {
    return new SendSessionSummary(
      s.context.games,
      s.context.teams,
      sender,
      s.context.clock,
      s.context.ids,
      WEB,
    );
  }

  it('envía el resumen a los webhooks suscritos a session.summary con una sola entrega', async () => {
    const s = setup();
    const team = await s.seedTeam([['session.summary'], ['issue.estimated'], ['session.summary']]);
    const game = await s.seedGame(team.slug);
    await s.revealedIssue(game.gameId, game.facilitatorId);

    const result = await sendSummary(s).execute({
      gameId: game.gameId,
      participantId: game.facilitatorId,
    });

    expect(result).toEqual({ delivered: 2, failed: 0 });
    expect(s.sender.sent.map(({ options }) => options)).toEqual([
      { retry: false },
      { retry: false },
    ]);
    expect(s.sender.bodies().map((body) => body.event)).toEqual([
      'session.summary',
      'session.summary',
    ]);
  });

  it('cuenta los envíos que fallan sin lanzar', async () => {
    const sender = new RecordingWebhookSender((request) =>
      request.url.endsWith('/0') ? FAILED_DELIVERY : { delivered: true, status: 204, attempts: 1 },
    );
    const s = setup(sender);
    const team = await s.seedTeam([['session.summary'], ['session.summary']]);
    const game = await s.seedGame(team.slug);

    const result = await sendSummary(s, sender).execute({
      gameId: game.gameId,
      participantId: game.facilitatorId,
    });

    expect(result).toEqual({ delivered: 1, failed: 1 });
  });

  it('una partida sin equipo no tiene a quién enviar y no es un error', async () => {
    const s = setup();
    const game = await s.seedGame();

    const result = await sendSummary(s).execute({
      gameId: game.gameId,
      participantId: game.facilitatorId,
    });

    expect(result).toEqual({ delivered: 0, failed: 0 });
    expect(s.sender.sent).toEqual([]);
  });

  it('solo lo puede pedir quien está en la partida', async () => {
    const s = setup();
    const team = await s.seedTeam([['session.summary']]);
    const game = await s.seedGame(team.slug);

    await expect(
      sendSummary(s).execute({ gameId: game.gameId, participantId: 'desconocido' }),
    ).rejects.toBeInstanceOf(ParticipantNotFoundError);
    expect(s.sender.sent).toEqual([]);
  });
});

describe('GetGameSummary: canSendToTeam', () => {
  it('es verdadero solo si el equipo tiene algún webhook suscrito a session.summary', async () => {
    const s = setup();
    const subscribed = await s.seedTeam([['session.summary']]);
    const notSubscribed = await s.seedTeam([['issue.estimated']]);
    const withHook = await s.seedGame(subscribed.slug);
    const withoutSummary = await s.seedGame(notSubscribed.slug);
    const noTeam = await s.seedGame();
    const getSummary = new GetGameSummary(s.context.games, s.context.teams);

    expect((await getSummary.execute({ gameId: withHook.gameId })).canSendToTeam).toBe(true);
    expect((await getSummary.execute({ gameId: withoutSummary.gameId })).canSendToTeam).toBe(false);
    expect((await getSummary.execute({ gameId: noTeam.gameId })).canSendToTeam).toBe(false);
  });

  it('no filtra ni la URL ni el secreto del webhook', async () => {
    const s = setup();
    const team = await s.seedTeam([['session.summary']]);
    const game = await s.seedGame(team.slug);

    const summary = await new GetGameSummary(s.context.games, s.context.teams).execute({
      gameId: game.gameId,
    });

    expect(JSON.stringify(summary)).not.toContain('hooks.example');
    expect(JSON.stringify(summary)).not.toContain('secreto');
  });
});

describe('TestWebhook', () => {
  function testWebhook(s: Harness, sender = s.sender): TestWebhook {
    return new TestWebhook(
      s.context.teams,
      s.context.hasher,
      sender,
      s.context.clock,
      s.context.ids,
    );
  }

  async function firstWebhookId(
    s: Harness,
    team: { slug: string; token: string },
  ): Promise<string> {
    const [webhook] = await new ListWebhooks(s.context.teams, s.context.hasher).execute(team);
    if (!webhook) throw new Error('el equipo no tiene webhooks');
    return webhook.id;
  }

  it('envía un ping con una sola entrega y devuelve el código HTTP', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated']]);
    const webhookId = await firstWebhookId(s, team);

    const result = await testWebhook(s).execute({ slug: team.slug, token: team.token, webhookId });

    expect(result).toEqual({ ok: true, status: 200, error: null });
    expect(s.sender.sent[0]?.options).toEqual({ retry: false });
    expect(s.sender.bodies()[0]).toMatchObject({
      event: 'ping',
      game: null,
      team: { slug: team.slug },
    });
  });

  it('devuelve el motivo cuando la entrega falla', async () => {
    const sender = new RecordingWebhookSender(() => FAILED_DELIVERY);
    const s = setup(sender);
    const team = await s.seedTeam([['issue.estimated']]);
    const webhookId = await firstWebhookId(s, team);

    const result = await testWebhook(s, sender).execute({
      slug: team.slug,
      token: team.token,
      webhookId,
    });

    expect(result).toEqual({ ok: false, status: 503, error: 'HTTP 503 tras 4 intentos' });
  });

  it('no envía a un webhook que no es del equipo', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated']]);

    await expect(
      testWebhook(s).execute({ slug: team.slug, token: team.token, webhookId: 'fantasma' }),
    ).rejects.toBeInstanceOf(WebhookNotFoundError);
    expect(s.sender.sent).toEqual([]);
  });

  it('exige el token del equipo', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated']]);
    const webhookId = await firstWebhookId(s, team);

    await expect(
      testWebhook(s).execute({ slug: team.slug, token: 'otro-token', webhookId }),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(s.sender.sent).toEqual([]);
  });
});

describe('gestión de webhooks', () => {
  it('el alta devuelve el secreto completo y el listado solo sus 4 últimos caracteres', async () => {
    const s = setup();
    const team = await s.seedTeam();

    const created = await new AddWebhook(
      s.context.teams,
      s.context.hasher,
      s.context.ids,
      s.secrets,
    ).execute({
      slug: team.slug,
      token: team.token,
      url: 'https://hooks.example/entrada',
      events: ['issue.estimated', 'session.summary'],
    });
    const listed = await new ListWebhooks(s.context.teams, s.context.hasher).execute(team);

    expect(created.secret).toMatch(/^secreto-de-prueba-\d{4}$/);
    expect(created.secretHint).toBe(created.secret.slice(-4));
    expect(listed).toEqual([
      {
        id: created.id,
        url: 'https://hooks.example/entrada',
        events: ['issue.estimated', 'session.summary'],
        secretHint: created.secret.slice(-4),
      },
    ]);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
  });

  it('cada alta genera un secreto distinto', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated'], ['issue.estimated']]);

    const stored = await s.context.teams.findById(TeamId.of(team.teamId));

    expect(new Set(stored?.webhooks.map((webhook) => webhook.secret)).size).toBe(2);
  });

  it('rechaza una URL que no es https', async () => {
    const s = setup();
    const team = await s.seedTeam();

    await expect(
      new AddWebhook(s.context.teams, s.context.hasher, s.context.ids, s.secrets).execute({
        slug: team.slug,
        token: team.token,
        url: 'http://hooks.example/entrada',
        events: ['issue.estimated'],
      }),
    ).rejects.toBeInstanceOf(InsecureWebhookUrlError);
  });

  it('rechaza un webhook sin eventos', async () => {
    const s = setup();
    const team = await s.seedTeam();

    await expect(
      new AddWebhook(s.context.teams, s.context.hasher, s.context.ids, s.secrets).execute({
        slug: team.slug,
        token: team.token,
        url: 'https://hooks.example/entrada',
        events: [],
      }),
    ).rejects.toBeInstanceOf(WebhookNeedsEventsError);
  });

  it('no deja pasar de tres webhooks por equipo', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated'], ['issue.estimated'], ['issue.estimated']]);

    await expect(
      new AddWebhook(s.context.teams, s.context.hasher, s.context.ids, s.secrets).execute({
        slug: team.slug,
        token: team.token,
        url: 'https://hooks.example/cuarto',
        events: ['issue.estimated'],
      }),
    ).rejects.toBeInstanceOf(TooManyWebhooksError);
  });

  it('exige el token del equipo para listar, añadir y quitar', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated']]);
    const bad = { slug: team.slug, token: 'otro-token' };

    await expect(
      new ListWebhooks(s.context.teams, s.context.hasher).execute(bad),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
    await expect(
      new AddWebhook(s.context.teams, s.context.hasher, s.context.ids, s.secrets).execute({
        ...bad,
        url: 'https://hooks.example/x',
        events: ['issue.estimated'],
      }),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
    await expect(
      new RemoveWebhook(s.context.teams, s.context.hasher).execute({ ...bad, webhookId: 'x' }),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('quitar un webhook lo borra, y quitar uno que no existe falla', async () => {
    const s = setup();
    const team = await s.seedTeam([['issue.estimated'], ['session.summary']]);
    const list = new ListWebhooks(s.context.teams, s.context.hasher);
    const [first] = await list.execute(team);
    if (!first) throw new Error('faltan webhooks');
    const remove = new RemoveWebhook(s.context.teams, s.context.hasher);

    await remove.execute({ ...team, webhookId: first.id });

    expect((await list.execute(team)).map((webhook) => webhook.events)).toEqual([
      ['session.summary'],
    ]);
    await expect(remove.execute({ ...team, webhookId: first.id })).rejects.toBeInstanceOf(
      WebhookNotFoundError,
    );
  });
});
