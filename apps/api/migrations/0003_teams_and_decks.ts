import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Bloque 7 (docs/adr/0006-equipos-y-barajas.md): `teams` para el ámbito sin cuentas de las
 * barajas personalizadas, `decks` para las dos de sistema + las personalizadas de cada equipo.
 * Los IDs de las dos filas de sistema son fijos y deben coincidir exactamente con
 * `SYSTEM_DECK_IDS` en `src/domain/deck/SavedDeck.ts` — de eso depende que
 * `DeckRepository.findById` resuelva lo mismo en Postgres que en memoria.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('token_hash', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('decks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('team_id', 'text', (col) => col.references('teams.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('cards', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('decks_team_id_idx').on('decks').column('team_id').execute();

  await sql`
    insert into decks (id, team_id, name, cards) values
      ('00000000-0000-0000-0000-000000000001', null, 'Fibonacci',
       '["0.5","1","2","3","5","8","13","?","☕"]'::jsonb),
      ('00000000-0000-0000-0000-000000000002', null, 'Tallas',
       '["XS","S","M","L","XL","XXL","?","☕"]'::jsonb)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('decks').execute();
  await db.schema.dropTable('teams').execute();
}
