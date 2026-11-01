import { WebhookId } from '../../domain/team/WebhookId.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';

export interface RemoveWebhookCommand {
  readonly slug: string;
  readonly token: string;
  readonly webhookId: string;
}

export class RemoveWebhook {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
  ) {}

  async execute(command: RemoveWebhookCommand): Promise<void> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    await this.teams.save(team.removeWebhook(WebhookId.of(command.webhookId)));
  }
}
