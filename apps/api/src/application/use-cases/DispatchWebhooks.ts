import type { WebhookEventName } from '@pp/contracts';
import type { GameEvent } from '../../domain/game/events/GameEvent.js';
import type { Game } from '../../domain/game/Game.js';
import type { GameId, IssueId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { RealtimeBroadcaster } from '../ports/RealtimeBroadcaster.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { WebhookSender } from '../ports/WebhookSender.js';
import { toWebhookPayload } from '../read-models/toWebhookPayload.js';
import type { WebhookTrigger } from '../read-models/toWebhookPayload.js';
import { toWebhookRequest } from './toWebhookRequest.js';

interface Delivery {
  readonly gameId: GameId;
  readonly kind: Extract<WebhookEventName, 'issue.estimated' | 'issues.imported'>;
  readonly occurredAt: Date;
  /** La tarea a la que avisa `webhook_failed` si la entrega falla; `null` si el hecho no es de una. */
  readonly issueId: IssueId | null;
  readonly trigger: (game: Game) => WebhookTrigger;
}

/**
 * Lleva a los webhooks del equipo lo que pasa en una partida (ADR 0028). Es un `EventPublisher`
 * más: un publicador compuesto de infraestructura le reenvía los eventos de dominio, y el dominio
 * no sabe que existen los webhooks. Solo reacciona a `IssueEstimated` e `IssuesImported`, y solo en
 * partidas creadas dentro de un equipo (sin equipo no hay dónde configurarlos).
 *
 * Si una entrega agota sus reintentos avisa a la sala con `webhook_failed`; nunca deshace la acción
 * que la provocó, que ya está guardada cuando este caso de uso se entera.
 */
export class DispatchWebhooks implements EventPublisher {
  constructor(
    private readonly games: GameRepository,
    private readonly teams: TeamRepository,
    private readonly sender: WebhookSender,
    private readonly broadcaster: RealtimeBroadcaster,
    private readonly ids: IdGenerator,
    /** Origen del front, para el enlace de la partida en el cuerpo. */
    private readonly webBaseUrl: string,
  ) {}

  async publishAll(events: ReadonlyArray<GameEvent>): Promise<void> {
    for (const event of events) {
      if (event.type === 'IssueEstimated') {
        await this.deliver({
          gameId: event.gameId,
          kind: 'issue.estimated',
          occurredAt: event.occurredAt,
          issueId: event.issueId,
          trigger: (game) => ({
            kind: 'issue.estimated',
            game,
            issueId: event.issueId,
            finalEstimate: event.finalEstimate,
          }),
        });
      } else if (event.type === 'IssuesImported') {
        await this.deliver({
          gameId: event.gameId,
          kind: 'issues.imported',
          occurredAt: event.occurredAt,
          issueId: null,
          trigger: (game) => ({ kind: 'issues.imported', game, issueIds: event.issueIds }),
        });
      }
    }
  }

  private async deliver(delivery: Delivery): Promise<void> {
    const game = await this.games.findById(delivery.gameId);
    const teamId = game?.currentTeamId();
    if (!game || !teamId) return;
    const team = await this.teams.findById(teamId);
    if (!team) return;

    await Promise.all(
      team.webhooksFor(delivery.kind).map(async (webhook) => {
        const payload = toWebhookPayload(delivery.trigger(game), {
          team,
          webBaseUrl: this.webBaseUrl,
          deliveryId: this.ids.generate(),
          occurredAt: delivery.occurredAt,
        });
        if (!payload) return;

        const outcome = await this.sender.send(toWebhookRequest(webhook, payload), { retry: true });
        if (!outcome.delivered) {
          await this.broadcaster.notifyGame(delivery.gameId, {
            type: 'webhook_failed',
            event: delivery.kind,
            issueId: delivery.issueId?.value ?? null,
          });
        }
      }),
    );
  }
}
