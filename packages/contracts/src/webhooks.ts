import { z } from 'zod';
import type { GameSummaryView } from './views.js';

/**
 * Los eventos a los que se puede suscribir un webhook. Mismo catálogo que `WEBHOOK_EVENTS` del
 * dominio de la api (el dominio no importa `contracts`); un test de la api los compara.
 */
export const WEBHOOK_EVENTS = ['issue.estimated', 'issues.imported', 'session.summary'] as const;
export const webhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEventName = z.infer<typeof webhookEventSchema>;

/** Mismo límite que `MAX_WEBHOOKS_PER_TEAM` del dominio; el front lo usa para deshabilitar el alta. */
export const MAX_WEBHOOKS_PER_TEAM = 3;

/** Sube cuando el cuerpo cambia de forma incompatible; el receptor puede comprobarlo (ADR 0028). */
export const WEBHOOK_PAYLOAD_VERSION = 1;

const nullableString = z.string().nullable();

/** `key` sale de `issueKeyFromUrl`; es `null` si la tarea no tiene enlace. Nunca lleva votos individuales. */
export const issueEstimatedDataSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  key: nullableString,
  externalUrl: nullableString,
  finalEstimate: z.string(),
  /** `null` si la carta no es un número (`M`, `?`, `☕`). */
  numericEstimate: z.number().nullable(),
  rounds: z.number().int().nonnegative(),
  agreementPercentage: z.number().nullable(),
});
export type IssueEstimatedData = z.infer<typeof issueEstimatedDataSchema>;

export const importedIssueSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  key: nullableString,
  externalUrl: nullableString,
});
export const issuesImportedDataSchema = z.object({ issues: z.array(importedIssueSchema) });
export type IssuesImportedData = z.infer<typeof issuesImportedDataSchema>;

/** Misma forma que `GameSummaryView` (ADR 0025): solo agregados, sin votos individuales. */
export const sessionSummaryDataSchema: z.ZodType<GameSummaryView> = z.object({
  id: z.string(),
  name: z.string(),
  issues: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: nullableString,
      externalUrl: nullableString,
      status: z.enum(['PENDING', 'VOTING', 'ESTIMATED']),
      finalEstimate: nullableString,
      rounds: z.number().int().nonnegative(),
      agreementPercentage: z.number().nullable(),
      average: z.number().nullable(),
      durationMs: z.number().nullable(),
    }),
  ),
  totals: z.object({
    estimatedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    points: z.number().nullable(),
    nonNumericEstimates: z.record(z.string(), z.number()),
    unanimousCount: z.number().int().nonnegative(),
    multiRoundCount: z.number().int().nonnegative(),
    averageDurationMs: z.number().nullable(),
    voterCount: z.number().int().nonnegative(),
  }),
});

const teamRefSchema = z.object({ slug: z.string(), name: z.string() });
const gameRefSchema = z.object({ id: z.string(), name: z.string(), url: z.string() });

const envelopeBase = {
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  deliveryId: z.string(),
  occurredAt: z.iso.datetime(),
  team: teamRefSchema,
};

/**
 * El cuerpo de cada envío. `ping` es la prueba manual de la página del equipo: no pertenece a
 * ninguna partida, así que su `game` es `null` y sus datos van vacíos.
 */
export const webhookEnvelopeSchema = z.discriminatedUnion('event', [
  z.object({
    ...envelopeBase,
    event: z.literal('issue.estimated'),
    game: gameRefSchema,
    data: issueEstimatedDataSchema,
  }),
  z.object({
    ...envelopeBase,
    event: z.literal('issues.imported'),
    game: gameRefSchema,
    data: issuesImportedDataSchema,
  }),
  z.object({
    ...envelopeBase,
    event: z.literal('session.summary'),
    game: gameRefSchema,
    data: sessionSummaryDataSchema,
  }),
  z.object({ ...envelopeBase, event: z.literal('ping'), game: z.null(), data: z.object({}) }),
]);
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;
export type WebhookEnvelopeOf<Event extends WebhookEnvelope['event']> = Extract<
  WebhookEnvelope,
  { event: Event }
>;

/** REST — `POST /api/teams/:slug/webhooks?k=`. La URL solo admite https; el dominio lo vuelve a comprobar. */
export const addWebhookCommandSchema = z.object({
  url: z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https$/ })),
  events: z.array(webhookEventSchema).min(1),
});
export type AddWebhookCommandInput = z.infer<typeof addWebhookCommandSchema>;

/** REST — `POST /api/games/:id/summary/webhook`. */
export const sendSessionSummaryCommandSchema = z.object({
  participantId: z.string().trim().min(1),
});
export type SendSessionSummaryCommandInput = z.infer<typeof sendSessionSummaryCommandSchema>;

/** Un webhook en los listados: el secreto solo muestra sus últimos 4 caracteres. */
export interface WebhookView {
  readonly id: string;
  readonly url: string;
  readonly events: ReadonlyArray<WebhookEventName>;
  readonly secretHint: string;
}

/** Respuesta del alta: el único momento en que el secreto viaja completo. */
export interface CreatedWebhookView extends WebhookView {
  readonly secret: string;
}

/** `POST /api/teams/:slug/webhooks/:webhookId/test?k=` — una sola entrega, sin reintentos. */
export interface WebhookTestResultView {
  readonly ok: boolean;
  /** Código HTTP del receptor; `null` si no llegó a contestar. */
  readonly status: number | null;
  readonly error: string | null;
}

/** `POST /api/games/:id/summary/webhook` — a cuántos webhooks llegó el resumen y a cuántos no. */
export interface SendSessionSummaryResultView {
  readonly delivered: number;
  readonly failed: number;
}
