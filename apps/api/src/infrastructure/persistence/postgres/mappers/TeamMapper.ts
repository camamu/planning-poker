import type { Insertable, Selectable } from 'kysely';
import { Team } from '../../../../domain/team/Team.js';
import { TeamId } from '../../../../domain/team/TeamId.js';
import { TeamName } from '../../../../domain/team/TeamName.js';
import { TeamSlug } from '../../../../domain/team/TeamSlug.js';
import { Webhook } from '../../../../domain/team/Webhook.js';
import { parseWebhookEvent } from '../../../../domain/team/WebhookEvent.js';
import { WebhookId } from '../../../../domain/team/WebhookId.js';
import { WebhookUrl } from '../../../../domain/team/WebhookUrl.js';
import type { TeamTable, TeamWebhookTable } from '../schema.js';

export function toTeamRow(team: Team): Insertable<TeamTable> {
  return {
    id: team.id.value,
    slug: team.slug.value,
    name: team.name.value,
    token_hash: team.tokenHash,
  };
}

export function toWebhookRows(team: Team): Insertable<TeamWebhookTable>[] {
  return team.webhooks.map((webhook) => ({
    id: webhook.id.value,
    team_id: team.id.value,
    url: webhook.url.value,
    events: JSON.stringify(webhook.events),
    secret: webhook.secret,
  }));
}

export function toDomainTeam(
  row: Selectable<TeamTable>,
  webhookRows: ReadonlyArray<Selectable<TeamWebhookTable>> = [],
): Team {
  return Team.reconstitute({
    id: TeamId.of(row.id),
    slug: TeamSlug.of(row.slug),
    name: TeamName.of(row.name),
    tokenHash: row.token_hash,
    webhooks: webhookRows.map((webhook) =>
      Webhook.reconstitute({
        id: WebhookId.of(webhook.id),
        url: WebhookUrl.of(webhook.url),
        events: webhook.events.map(parseWebhookEvent),
        secret: webhook.secret,
      }),
    ),
  });
}
