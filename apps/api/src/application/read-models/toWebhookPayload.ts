import { WEBHOOK_PAYLOAD_VERSION, issueKeyFromUrl } from '@pp/contracts';
import type { WebhookEnvelope } from '@pp/contracts';
import type { CardValue } from '../../domain/deck/CardValue.js';
import type { Game } from '../../domain/game/Game.js';
import type { IssueId } from '../../domain/game/ids.js';
import type { Team } from '../../domain/team/Team.js';
import { toGameSummaryView } from './toGameSummaryView.js';
import { toIssueView } from './toGameView.js';

/** Qué hecho se envía y con qué datos de la partida. `ping` no pertenece a ninguna. */
export type WebhookTrigger =
  | {
      readonly kind: 'issue.estimated';
      readonly game: Game;
      readonly issueId: IssueId;
      readonly finalEstimate: CardValue;
    }
  | {
      readonly kind: 'issues.imported';
      readonly game: Game;
      readonly issueIds: ReadonlyArray<IssueId>;
    }
  | { readonly kind: 'session.summary'; readonly game: Game }
  | { readonly kind: 'ping' };

export interface WebhookContext {
  readonly team: Team;
  /** Origen del front, para construir el enlace de la partida. */
  readonly webBaseUrl: string;
  readonly deliveryId: string;
  readonly occurredAt: Date;
}

type EnvelopeCommon = Pick<WebhookEnvelope, 'version' | 'deliveryId' | 'occurredAt' | 'team'>;

function keyOf(externalUrl: string | null): string | null {
  return externalUrl === null ? null : issueKeyFromUrl(externalUrl);
}

/**
 * Cuerpo versionado de cada envío (ADR 0028). Solo agregados, igual que el resumen de sesión
 * (ADR 0025): ninguna rama llega a leer un voto individual. `null` si el hecho ya no se puede
 * describir, p. ej. una tarea que ha desaparecido entre el guardado y esta lectura.
 */
export function toWebhookPayload(
  trigger: WebhookTrigger,
  context: WebhookContext,
): WebhookEnvelope | null {
  const common: EnvelopeCommon = {
    version: WEBHOOK_PAYLOAD_VERSION,
    deliveryId: context.deliveryId,
    occurredAt: context.occurredAt.toISOString(),
    team: { slug: context.team.slug.value, name: context.team.name.value },
  };

  switch (trigger.kind) {
    case 'ping':
      return toPingPayload(context);
    case 'issue.estimated':
      return issueEstimated(trigger, context, common);
    case 'issues.imported':
      return {
        ...common,
        event: 'issues.imported',
        game: gameRef(trigger.game, context),
        data: {
          issues: trigger.issueIds.flatMap((issueId) => {
            const issue = trigger.game.findIssue(issueId);
            if (!issue) return [];
            const view = toIssueView(issue);
            return [
              {
                issueId: view.id,
                title: view.title,
                key: keyOf(view.externalUrl),
                externalUrl: view.externalUrl,
              },
            ];
          }),
        },
      };
    case 'session.summary':
      return {
        ...common,
        event: 'session.summary',
        game: gameRef(trigger.game, context),
        data: toGameSummaryView(trigger.game),
      };
  }
}

/** La prueba manual de la página del equipo: no pertenece a ninguna partida. */
export function toPingPayload(
  context: WebhookContext,
): Extract<WebhookEnvelope, { event: 'ping' }> {
  return {
    version: WEBHOOK_PAYLOAD_VERSION,
    event: 'ping',
    deliveryId: context.deliveryId,
    occurredAt: context.occurredAt.toISOString(),
    team: { slug: context.team.slug.value, name: context.team.name.value },
    game: null,
    data: {},
  };
}

function gameRef(game: Game, context: WebhookContext): { id: string; name: string; url: string } {
  const base = context.webBaseUrl.replace(/\/+$/, '');
  return {
    id: game.id.value,
    name: game.currentName().value,
    url: `${base}/games/${game.id.value}`,
  };
}

function issueEstimated(
  trigger: Extract<WebhookTrigger, { kind: 'issue.estimated' }>,
  context: WebhookContext,
  common: EnvelopeCommon,
): WebhookEnvelope | null {
  const issue = toGameSummaryView(trigger.game).issues.find(
    (candidate) => candidate.id === trigger.issueId.value,
  );
  if (!issue) return null;

  const estimate = trigger.finalEstimate;
  return {
    ...common,
    event: 'issue.estimated',
    game: gameRef(trigger.game, context),
    data: {
      issueId: issue.id,
      title: issue.title,
      key: keyOf(issue.externalUrl),
      externalUrl: issue.externalUrl,
      finalEstimate: estimate.raw,
      numericEstimate: estimate.special ? null : estimate.numeric,
      rounds: issue.rounds,
      agreementPercentage: issue.agreementPercentage,
    },
  };
}
