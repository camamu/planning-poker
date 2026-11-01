import type { WebhookView } from '@pp/contracts';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { toWebhookView } from '../read-models/toWebhookView.js';
import { resolveTeam } from './resolveTeam.js';

export interface ListWebhooksCommand {
  readonly slug: string;
  readonly token: string;
}

export class ListWebhooks {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
  ) {}

  async execute(command: ListWebhooksCommand): Promise<ReadonlyArray<WebhookView>> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    return team.webhooks.map(toWebhookView);
  }
}
