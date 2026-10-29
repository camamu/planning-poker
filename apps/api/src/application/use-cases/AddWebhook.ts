import type { CreatedWebhookView } from '@pp/contracts';
import { parseWebhookEvent } from '../../domain/team/WebhookEvent.js';
import { WebhookId } from '../../domain/team/WebhookId.js';
import { WebhookUrl } from '../../domain/team/WebhookUrl.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { SecretGenerator } from '../ports/SecretGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { toCreatedWebhookView } from '../read-models/toWebhookView.js';
import { resolveTeam } from './resolveTeam.js';

export interface AddWebhookCommand {
  readonly slug: string;
  readonly token: string;
  readonly url: string;
  readonly events: ReadonlyArray<string>;
}

/** El secreto lo genera la api y esta es la única respuesta que lo lleva completo (ADR 0028). */
export class AddWebhook {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly ids: IdGenerator,
    private readonly secrets: SecretGenerator,
  ) {}

  async execute(command: AddWebhookCommand): Promise<CreatedWebhookView> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    const id = WebhookId.of(this.ids.generate());

    const updated = team.addWebhook(
      id,
      WebhookUrl.of(command.url),
      command.events.map(parseWebhookEvent),
      this.secrets.generate(),
    );
    await this.teams.save(updated);

    const created = updated.findWebhook(id);
    if (!created) throw new Error('el webhook recién añadido no está en el equipo');
    return toCreatedWebhookView(created);
  }
}
