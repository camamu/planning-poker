import type { Kysely, Selectable } from 'kysely';
import type { TeamRepository } from '../../../application/ports/TeamRepository.js';
import type { Team } from '../../../domain/team/Team.js';
import type { TeamId } from '../../../domain/team/TeamId.js';
import type { TeamSlug } from '../../../domain/team/TeamSlug.js';
import { toDomainTeam, toTeamRow, toWebhookRows } from './mappers/TeamMapper.js';
import type { Database, TeamTable } from './schema.js';

export class PostgresTeamRepository implements TeamRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findBySlug(slug: TeamSlug): Promise<Team | undefined> {
    const row = await this.db
      .selectFrom('teams')
      .selectAll()
      .where('slug', '=', slug.value)
      .executeTakeFirst();
    return row ? this.withWebhooks([row]).then(([team]) => team) : undefined;
  }

  async findById(id: TeamId): Promise<Team | undefined> {
    const row = await this.db
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.withWebhooks([row]).then(([team]) => team) : undefined;
  }

  async listAll(): Promise<ReadonlyArray<Team>> {
    const rows = await this.db.selectFrom('teams').selectAll().orderBy('name', 'asc').execute();
    return this.withWebhooks(rows);
  }

  /**
   * Los webhooks son inmutables una vez creados (solo se añaden y se quitan), así que se sincronizan
   * por diferencia en vez de reescribirlos: borrar y reinsertar los dejaría con el mismo `created_at`
   * y sin orden estable.
   */
  async save(team: Team): Promise<void> {
    const row = toTeamRow(team);
    const webhookRows = toWebhookRows(team);
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('teams')
        .values(row)
        .onConflict((oc) =>
          oc
            .column('id')
            .doUpdateSet({ name: row.name, slug: row.slug, token_hash: row.token_hash }),
        )
        .execute();

      const kept = webhookRows.map((webhook) => webhook.id);
      await trx
        .deleteFrom('team_webhooks')
        .where('team_id', '=', row.id)
        .$if(kept.length > 0, (query) => query.where('id', 'not in', kept))
        .execute();
      if (webhookRows.length > 0) {
        await trx
          .insertInto('team_webhooks')
          .values(webhookRows)
          .onConflict((oc) => oc.column('id').doNothing())
          .execute();
      }
    });
  }

  /** Las barajas del equipo caen por la FK en cascada; sus partidas quedan con `team_id` a null. */
  async delete(id: TeamId): Promise<void> {
    await this.db.deleteFrom('teams').where('id', '=', id.value).execute();
  }

  private async withWebhooks(rows: ReadonlyArray<Selectable<TeamTable>>): Promise<Team[]> {
    if (rows.length === 0) return [];
    const webhooks = await this.db
      .selectFrom('team_webhooks')
      .selectAll()
      .where(
        'team_id',
        'in',
        rows.map((row) => row.id),
      )
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();
    return rows.map((row) =>
      toDomainTeam(
        row,
        webhooks.filter((webhook) => webhook.team_id === row.id),
      ),
    );
  }
}
