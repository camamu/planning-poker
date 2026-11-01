import type { WebhookTestResultView } from '@pp/contracts';
import type { Clock } from '../../domain/shared/Clock.js';
import { WebhookNotFoundError } from '../../domain/team/Team.js';
import { WebhookId } from '../../domain/team/WebhookId.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import type { WebhookSender } from '../ports/WebhookSender.js';
import { toPingPayload } from '../read-models/toWebhookPayload.js';
import { resolveTeam } from './resolveTeam.js';
import { toWebhookRequest } from './toWebhookRequest.js';

export interface TestWebhookCommand {
  readonly slug: string;
  readonly token: string;
  readonly webhookId: string;
}

/** «Enviar prueba»: un `ping` con una sola entrega, y el resultado tal cual para enseñarlo. */
export class TestWebhook {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly sender: WebhookSender,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: TestWebhookCommand): Promise<WebhookTestResultView> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    const id = WebhookId.of(command.webhookId);
    const webhook = team.findWebhook(id);
    if (!webhook) throw new WebhookNotFoundError(id);

    const payload = toPingPayload({
      team,
      webBaseUrl: '',
      deliveryId: this.ids.generate(),
      occurredAt: this.clock.now(),
    });
    const outcome = await this.sender.send(toWebhookRequest(webhook, payload), { retry: false });

    return outcome.delivered
      ? { ok: true, status: outcome.status, error: null }
      : { ok: false, status: outcome.status, error: outcome.reason };
  }
}
