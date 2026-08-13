import type { Insertable, Selectable } from 'kysely';
import { Team } from '../../../../domain/team/Team.js';
import { TeamId } from '../../../../domain/team/TeamId.js';
import { TeamName } from '../../../../domain/team/TeamName.js';
import { TeamSlug } from '../../../../domain/team/TeamSlug.js';
import type { TeamTable } from '../schema.js';

export function toTeamRow(team: Team): Insertable<TeamTable> {
  return {
    id: team.id.value,
    slug: team.slug.value,
    name: team.name.value,
    token_hash: team.tokenHash,
  };
}

export function toDomainTeam(row: Selectable<TeamTable>): Team {
  return Team.reconstitute({
    id: TeamId.of(row.id),
    slug: TeamSlug.of(row.slug),
    name: TeamName.of(row.name),
    tokenHash: row.token_hash,
  });
}
