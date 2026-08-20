import type { Kysely } from 'kysely';

/**
 * `docs/02-decisiones-y-plan.md` §2 preveía esta columna junto a `teams`/`decks`, pero la
 * migración del bloque 7 solo la añadió a `decks`: una partida creada desde `/?team=slug` copiaba
 * la baraja y perdía el rastro del equipo. `on delete set null` y no `cascade`: borrar el equipo
 * no puede llevarse por delante partidas ya jugadas.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('games')
    .addColumn('team_id', 'text', (col) => col.references('teams.id').onDelete('set null'))
    .execute();

  await db.schema.createIndex('games_team_id_idx').on('games').column('team_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('games_team_id_idx').execute();
  await db.schema.alterTable('games').dropColumn('team_id').execute();
}
