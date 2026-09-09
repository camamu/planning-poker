import type { Kysely } from 'kysely';
import type { TeamRepository } from '../../../application/ports/TeamRepository.js';
import type { Team } from '../../../domain/team/Team.js';
import type { TeamSlug } from '../../../domain/team/TeamSlug.js';
import { toDomainTeam, toTeamRow } from './mappers/TeamMapper.js';
import type { Database } from './schema.js';

export class PostgresTeamRepository implements TeamRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findBySlug(slug: TeamSlug): Promise<Team | undefined> {
    const row = await this.db
      .selectFrom('teams')
      .selectAll()
      .where('slug', '=', slug.value)
      .executeTakeFirst();
    return row ? toDomainTeam(row) : undefined;
  }

  async save(team: Team): Promise<void> {
    const row = toTeamRow(team);
    await this.db
      .insertInto('teams')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({ name: row.name, slug: row.slug, token_hash: row.token_hash }),
      )
      .execute();
  }
}
