import { webhookEnvelopeSchema } from '@pp/contracts';
import type { WebhookEnvelope } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { toGameSummaryView } from '../../src/application/read-models/toGameSummaryView.js';
import { toWebhookPayload } from '../../src/application/read-models/toWebhookPayload.js';
import type { WebhookContext } from '../../src/application/read-models/toWebhookPayload.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import type { Game } from '../../src/domain/game/Game.js';
import { IssueId, RoundId } from '../../src/domain/game/ids.js';
import { Team } from '../../src/domain/team/Team.js';
import { TeamId } from '../../src/domain/team/TeamId.js';
import { TeamName } from '../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../src/domain/team/TeamSlug.js';
import { NOW, addVoter, createGame, nextId } from '../domain/support/gameFixtures.js';

const team = Team.create({
  id: TeamId.of('team-1'),
  slug: TeamSlug.of('backend-ab12cd'),
  name: TeamName.of('Backend'),
  tokenHash: 'hash',
});

function context(overrides: Partial<WebhookContext> = {}): WebhookContext {
  return {
    team,
    webBaseUrl: 'https://pp.example',
    deliveryId: 'delivery-1',
    occurredAt: NOW,
    ...overrides,
  };
}

interface EstimatedFixture {
  readonly game: Game;
  readonly issueId: IssueId;
  readonly voterIds: ReadonlyArray<string>;
}

interface FixtureOptions {
  readonly externalUrl?: string;
  readonly deck?: Deck;
  /** Cartas de las dos personas que votan en la primera ronda. */
  readonly votes?: readonly [string, string];
  readonly estimate: string;
}

/** Una tarea votada por dos personas con cartas distintas, revelada y estimada. */
function estimatedGame(options: FixtureOptions): EstimatedFixture {
  const { game, facilitatorId } = createGame(options.deck ? { deck: options.deck } : {});
  const other = addVoter(game, 'Grace');
  const issueId = IssueId.of(nextId('issue'));
  game.addIssue(
    issueId,
    'Login',
    NOW,
    options.externalUrl ? { externalUrl: options.externalUrl } : {},
  );
  const [first, second] = options.votes ?? ['3', '8'];
  game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);
  game.castVote(facilitatorId, CardValue.of(first), NOW);
  game.castVote(other, CardValue.of(second), NOW);
  game.reveal(facilitatorId, NOW);
  game.setFinalEstimate(CardValue.of(options.estimate), facilitatorId, NOW);
  return { game, issueId, voterIds: [facilitatorId.value, other.value] };
}

function issueEstimated(
  fixture: EstimatedFixture,
  estimate: string,
  overrides: Partial<WebhookContext> = {},
): Extract<WebhookEnvelope, { event: 'issue.estimated' }> {
  const payload = toWebhookPayload(
    {
      kind: 'issue.estimated',
      game: fixture.game,
      issueId: fixture.issueId,
      finalEstimate: CardValue.of(estimate),
    },
    context(overrides),
  );
  if (payload?.event !== 'issue.estimated') throw new Error('no se ha generado issue.estimated');
  return payload;
}

describe('toWebhookPayload: issue.estimated', () => {
  it('el cuerpo de issue.estimated no contiene votos individuales', () => {
    const fixture = estimatedGame({ estimate: '5' });

    const payload = issueEstimated(fixture, '5');

    const json = JSON.stringify(payload);
    for (const voterId of fixture.voterIds) expect(json).not.toContain(voterId);
    expect(json).not.toContain('votes');
    expect(json).not.toContain('"card"');
    expect(json).not.toContain('Grace');
  });

  it('la clave se deriva de la URL externa', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['https://acme.atlassian.net/browse/ABC-123', 'ABC-123'],
      ['https://github.com/acme/app/issues/42', 'app#42'],
      ['https://linear.app/acme/issue/ENG-12/titulo', 'ENG-12'],
    ];

    for (const [externalUrl, key] of cases) {
      const payload = issueEstimated(estimatedGame({ externalUrl, estimate: '5' }), '5');

      expect(payload.data.key).toBe(key);
      expect(payload.data.externalUrl).toBe(externalUrl);
    }
  });

  it('una tarea sin enlace no tiene clave ni URL', () => {
    const payload = issueEstimated(estimatedGame({ estimate: '5' }), '5');

    expect(payload.data.key).toBeNull();
    expect(payload.data.externalUrl).toBeNull();
  });

  it('numericEstimate es el número de la carta, y nulo si la carta no es un número', () => {
    const numeric = issueEstimated(estimatedGame({ estimate: '5' }), '5');
    const size = issueEstimated(
      estimatedGame({ deck: Deck.tshirt(), votes: ['S', 'M'], estimate: 'M' }),
      'M',
    );
    const unsure = issueEstimated(
      estimatedGame({ deck: Deck.tshirt(), votes: ['S', 'M'], estimate: '?' }),
      '?',
    );

    expect(numeric.data.numericEstimate).toBe(5);
    expect(size.data.numericEstimate).toBeNull();
    expect(size.data.finalEstimate).toBe('M');
    expect(unsure.data.numericEstimate).toBeNull();
  });

  it('numericEstimate conserva los decimales de las cartas como 0.5', () => {
    const payload = issueEstimated(estimatedGame({ estimate: '0.5' }), '0.5');

    expect(payload.data.numericEstimate).toBe(0.5);
  });

  it('cuenta las rondas reveladas y toma el acuerdo de la última', () => {
    const { game, facilitatorId } = createGame();
    const other = addVoter(game, 'Grace');
    const issueId = IssueId.of(nextId('issue'));
    game.addIssue(issueId, 'Login', NOW);
    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);
    game.castVote(facilitatorId, CardValue.of('3'), NOW);
    game.castVote(other, CardValue.of('13'), NOW);
    game.reveal(facilitatorId, NOW);
    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.castVote(other, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);
    game.setFinalEstimate(CardValue.of('5'), facilitatorId, NOW);

    const payload = issueEstimated({ game, issueId, voterIds: [] }, '5');

    expect(payload.data.rounds).toBe(2);
    expect(payload.data.agreementPercentage).toBe(100);
  });

  it('lleva el equipo, el enlace de la partida, la versión y el identificador de la entrega', () => {
    const fixture = estimatedGame({ estimate: '5' });

    const payload = issueEstimated(fixture, '5', {
      webBaseUrl: 'https://pp.example///',
      deliveryId: 'entrega-7',
    });

    expect(payload.version).toBe(1);
    expect(payload.deliveryId).toBe('entrega-7');
    expect(payload.occurredAt).toBe(NOW.toISOString());
    expect(payload.team).toEqual({ slug: 'backend-ab12cd', name: 'Backend' });
    expect(payload.game).toEqual({
      id: fixture.game.id.value,
      name: 'Sprint 42',
      url: `https://pp.example/games/${fixture.game.id.value}`,
    });
  });

  it('cumple el contrato publicado en contracts', () => {
    const payload = issueEstimated(
      estimatedGame({ externalUrl: 'https://x.example/browse/AB-1', estimate: '8' }),
      '8',
    );

    expect(webhookEnvelopeSchema.safeParse(payload).success).toBe(true);
  });

  it('no genera cuerpo para una tarea que ya no existe', () => {
    const { game } = estimatedGame({ estimate: '5' });

    const payload = toWebhookPayload(
      {
        kind: 'issue.estimated',
        game,
        issueId: IssueId.of('fantasma'),
        finalEstimate: CardValue.of('5'),
      },
      context(),
    );

    expect(payload).toBeNull();
  });
});

describe('toWebhookPayload: issues.imported', () => {
  function gameWithIssues(): { game: Game; ids: IssueId[] } {
    const { game } = createGame();
    const ids = [
      IssueId.of(nextId('issue')),
      IssueId.of(nextId('issue')),
      IssueId.of(nextId('issue')),
    ];
    game.importIssues(
      [
        {
          id: ids[0] ?? IssueId.of('x'),
          title: 'Login',
          externalUrl: 'https://x.example/browse/AB-1',
        },
        { id: ids[1] ?? IssueId.of('x'), title: 'Pagos' },
        {
          id: ids[2] ?? IssueId.of('x'),
          title: 'Informes',
          externalUrl: 'https://github.com/a/b/issues/7',
        },
      ],
      NOW,
    );
    return { game, ids };
  }

  it('lista las tareas importadas con su clave y enlace, en el orden recibido', () => {
    const { game, ids } = gameWithIssues();

    const payload = toWebhookPayload({ kind: 'issues.imported', game, issueIds: ids }, context());

    if (payload?.event !== 'issues.imported') throw new Error('no se ha generado issues.imported');
    expect(payload.data.issues.map((issue) => [issue.title, issue.key, issue.externalUrl])).toEqual(
      [
        ['Login', 'AB-1', 'https://x.example/browse/AB-1'],
        ['Pagos', null, null],
        ['Informes', 'b#7', 'https://github.com/a/b/issues/7'],
      ],
    );
    expect(webhookEnvelopeSchema.safeParse(payload).success).toBe(true);
  });

  it('solo incluye las tareas indicadas y salta las que ya no existen', () => {
    const { game, ids } = gameWithIssues();

    const payload = toWebhookPayload(
      {
        kind: 'issues.imported',
        game,
        issueIds: [ids[1] ?? IssueId.of('x'), IssueId.of('fantasma')],
      },
      context(),
    );

    if (payload?.event !== 'issues.imported') throw new Error('no se ha generado issues.imported');
    expect(payload.data.issues.map((issue) => issue.title)).toEqual(['Pagos']);
  });
});

describe('toWebhookPayload: session.summary y ping', () => {
  it('session.summary lleva el resumen completo, el mismo que el de la página', () => {
    const { game } = estimatedGame({ estimate: '5' });

    const payload = toWebhookPayload({ kind: 'session.summary', game }, context());

    if (payload?.event !== 'session.summary') throw new Error('no se ha generado session.summary');
    expect(payload.data).toEqual(toGameSummaryView(game));
    expect(webhookEnvelopeSchema.safeParse(payload).success).toBe(true);
  });

  it('session.summary no lleva votos individuales', () => {
    const fixture = estimatedGame({ estimate: '5' });

    const json = JSON.stringify(
      toWebhookPayload({ kind: 'session.summary', game: fixture.game }, context()),
    );

    for (const voterId of fixture.voterIds) expect(json).not.toContain(voterId);
  });

  it('ping no pertenece a ninguna partida y lleva solo el equipo', () => {
    const payload = toWebhookPayload({ kind: 'ping' }, context());

    expect(payload).toMatchObject({ event: 'ping', game: null, data: {} });
    expect(payload?.team).toEqual({ slug: 'backend-ab12cd', name: 'Backend' });
    expect(webhookEnvelopeSchema.safeParse(payload).success).toBe(true);
  });
});
