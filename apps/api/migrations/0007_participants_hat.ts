import type { Kysely } from 'kysely';

/** Sombrero del avatar (docs/adr/0017-sombreros-de-avatar.md). `null` = sin sombrero. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('participants').addColumn('hat', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('participants').dropColumn('hat').execute();
}
