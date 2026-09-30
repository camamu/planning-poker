import type { Kysely } from 'kysely';
import type { TeamRepository } from '../../../application/ports/TeamRepository.js';
import type { Team } from '../../../domain/team/Team.js';
import type { TeamId } from '../../../domain/team/TeamId.js';
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

  async findById(id: TeamId): Promise<Team | undefined> {
    const row = await this.db
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? toDomainTeam(row) : undefined;
  }

  async listAll(): Promise<ReadonlyArray<Team>> {
    const rows = await this.db.selectFrom('teams').selectAll().orderBy('name', 'asc').execute();
    return rows.map(toDomainTeam);
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

  /** Las barajas del equipo caen por la FK en cascada; sus partidas quedan con `team_id` a null. */
  async delete(id: TeamId): Promise<void> {
    await this.db.deleteFrom('teams').where('id', '=', id.value).execute();
  }
}
