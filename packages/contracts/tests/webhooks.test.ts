import { describe, expect, it } from 'vitest';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_PAYLOAD_VERSION,
  addWebhookCommandSchema,
  webhookEnvelopeSchema,
} from '../src/index.js';

const base = {
  version: WEBHOOK_PAYLOAD_VERSION,
  deliveryId: 'delivery-1',
  occurredAt: '2026-08-07T10:00:00.000Z',
  team: { slug: 'backend-ab12cd', name: 'Backend' },
  game: { id: 'game-1', name: 'Sprint 42', url: 'https://pp.example/games/game-1' },
};

const issueEstimated = {
  ...base,
  event: 'issue.estimated',
  data: {
    issueId: 'issue-1',
    title: 'Login',
    key: 'ABC-123',
    externalUrl: 'https://acme.atlassian.net/browse/ABC-123',
    finalEstimate: '5',
    numericEstimate: 5,
    rounds: 2,
    agreementPercentage: 100,
  },
};

describe('webhookEnvelopeSchema', () => {
  it('acepta un issue.estimated con la forma documentada', () => {
    expect(webhookEnvelopeSchema.safeParse(issueEstimated).success).toBe(true);
  });

  it('acepta una estimación no numérica con numericEstimate nulo y una tarea sin enlace', () => {
    const parsed = webhookEnvelopeSchema.safeParse({
      ...issueEstimated,
      data: {
        ...issueEstimated.data,
        key: null,
        externalUrl: null,
        finalEstimate: 'M',
        numericEstimate: null,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('acepta un issues.imported con su lista de tareas', () => {
    const parsed = webhookEnvelopeSchema.safeParse({
      ...base,
      event: 'issues.imported',
      data: {
        issues: [{ issueId: 'i1', title: 'Login', key: 'ABC-1', externalUrl: 'https://x/ABC-1' }],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('acepta un ping, que no pertenece a ninguna partida', () => {
    const parsed = webhookEnvelopeSchema.safeParse({
      ...base,
      event: 'ping',
      game: null,
      data: {},
    });

    expect(parsed.success).toBe(true);
  });

  it('exige una partida en los eventos que salen de una partida', () => {
    expect(webhookEnvelopeSchema.safeParse({ ...issueEstimated, game: null }).success).toBe(false);
  });

  it('rechaza una versión del cuerpo que no es la actual', () => {
    expect(webhookEnvelopeSchema.safeParse({ ...issueEstimated, version: 2 }).success).toBe(false);
  });

  it('rechaza un evento desconocido', () => {
    expect(
      webhookEnvelopeSchema.safeParse({ ...issueEstimated, event: 'issue.deleted' }).success,
    ).toBe(false);
  });

  it('un session.summary lleva el resumen completo', () => {
    const summary = {
      id: 'game-1',
      name: 'Sprint 42',
      issues: [
        {
          id: 'i1',
          title: 'Login',
          description: null,
          externalUrl: null,
          status: 'ESTIMATED',
          finalEstimate: '5',
          rounds: 1,
          agreementPercentage: 100,
          average: 5,
          durationMs: 60_000,
        },
      ],
      totals: {
        estimatedCount: 1,
        pendingCount: 0,
        points: 5,
        nonNumericEstimates: {},
        unanimousCount: 1,
        multiRoundCount: 0,
        averageDurationMs: 60_000,
        voterCount: 3,
      },
    };

    const parsed = webhookEnvelopeSchema.safeParse({
      ...base,
      event: 'session.summary',
      data: summary,
    });

    expect(parsed.success).toBe(true);
  });
});

describe('addWebhookCommandSchema', () => {
  const valid = { url: 'https://hooks.example/entrada', events: ['issue.estimated'] };

  it('acepta una URL https y al menos un evento conocido', () => {
    expect(addWebhookCommandSchema.parse(valid)).toEqual(valid);
  });

  it('recorta la URL', () => {
    expect(
      addWebhookCommandSchema.parse({ ...valid, url: '  https://hooks.example/a  ' }).url,
    ).toBe('https://hooks.example/a');
  });

  it('rechaza una URL http o que no es una URL', () => {
    for (const url of ['http://hooks.example/a', 'ftp://hooks.example/a', 'hooks.example', '']) {
      expect(addWebhookCommandSchema.safeParse({ ...valid, url }).success).toBe(false);
    }
  });

  it('rechaza una lista de eventos vacía o con un evento desconocido', () => {
    expect(addWebhookCommandSchema.safeParse({ ...valid, events: [] }).success).toBe(false);
    expect(addWebhookCommandSchema.safeParse({ ...valid, events: ['ping'] }).success).toBe(false);
  });

  it('conoce exactamente los tres eventos suscribibles', () => {
    expect([...WEBHOOK_EVENTS]).toEqual(['issue.estimated', 'issues.imported', 'session.summary']);
  });
});
