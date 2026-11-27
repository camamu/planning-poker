import type { Kysely } from 'kysely';

/**
 * Ajuste de sala «Nevada» (docs/adr/0031-ambientacion-navidena.md). Activado por defecto, también
 * en las partidas que ya existen: fuera de la temporada de invierno no se nota.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('games')
    .addColumn('snow', 'boolean', (column) => column.notNull().defaultTo(true))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('games').dropColumn('snow').execute();
}
