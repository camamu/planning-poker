import type { Kysely } from 'kysely';

/**
 * Modo de cada ronda: `LIVE` (la mesa) o `ASYNC` (votación en diferido), ver
 * docs/adr/0027-votacion-asincrona.md. Las rondas que ya existen eran todas en vivo, de ahí el
 * valor por defecto; sin él la migración fallaría con filas en la tabla.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('rounds')
    .addColumn('mode', 'text', (column) => column.notNull().defaultTo('LIVE'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('rounds').dropColumn('mode').execute();
}
