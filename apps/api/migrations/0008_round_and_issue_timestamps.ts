import type { Kysely } from 'kysely';

/**
 * Cuándo se abrió cada ronda y cuándo se estimó cada tarea (docs/adr/0024-tiempos-e-historico.md).
 * Nulas a propósito: las filas anteriores a esta migración quedan con tiempo desconocido en vez de
 * uno inventado, y el dominio lo lee como `null`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('rounds').addColumn('opened_at', 'timestamptz').execute();
  await db.schema.alterTable('issues').addColumn('estimated_at', 'timestamptz').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('issues').dropColumn('estimated_at').execute();
  await db.schema.alterTable('rounds').dropColumn('opened_at').execute();
}
