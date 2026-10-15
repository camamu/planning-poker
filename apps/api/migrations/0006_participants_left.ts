import type { Kysely } from 'kysely';

/**
 * Baja lógica de participantes (docs/adr/0015-presencia-y-salida-de-participantes.md): borrar la
 * fila rompería los votos de rondas ya reveladas, que apuntan a ella con `on delete cascade`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('participants')
    .addColumn('left', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('participants').dropColumn('left').execute();
}
