import type { SendSessionSummaryResultView } from '@pp/contracts';
import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { WebhookSender } from '../ports/WebhookSender.js';
import { toWebhookPayload } from '../read-models/toWebhookPayload.js';
import { loadGame } from './loadGame.js';
import { toWebhookRequest } from './toWebhookRequest.js';

export interface SendSessionSummaryCommand {
  readonly gameId: string;
  readonly participantId: string;
}

/**
 * «Enviar resumen» (ADR 0028): a diferencia de los eventos automáticos, lo pide una persona y espera
 * el resultado, así que cada envío es una sola entrega, sin reintentos. Cualquier participante de la
 * partida puede pedirlo; sin equipo o sin webhooks suscritos no hay a quién enviar y no es un error.
 */
export class SendSessionSummary {
  constructor(
    private readonly games: GameRepository,
    private readonly teams: TeamRepository,
    private readonly sender: WebhookSender,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly webBaseUrl: string,
  ) {}

  async execute(command: SendSessionSummaryCommand): Promise<SendSessionSummaryResultView> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    game.assertParticipant(ParticipantId.of(command.participantId));

    const teamId = game.currentTeamId();
    const team = teamId ? await this.teams.findById(teamId) : undefined;
    if (!team) return { delivered: 0, failed: 0 };

    const outcomes = await Promise.all(
      team.webhooksFor('session.summary').map(async (webhook) => {
        const payload = toWebhookPayload(
          { kind: 'session.summary', game },
          {
            team,
            webBaseUrl: this.webBaseUrl,
            deliveryId: this.ids.generate(),
            occurredAt: this.clock.now(),
          },
        );
        if (!payload) return false;
        const outcome = await this.sender.send(toWebhookRequest(webhook, payload), {
          retry: false,
        });
        return outcome.delivered;
      }),
    );

    const delivered = outcomes.filter(Boolean).length;
    return { delivered, failed: outcomes.length - delivered };
  }
}
