import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Webhooks salientes de cada equipo (docs/adr/0028-webhooks-salientes.md). El secreto de la firma
 * se guarda en claro porque hace falta para firmar cada envío. Se activa RLS como en la migración
 * 0005 (ADR 0013): Supabase expone `public` por PostgREST y, sin RLS, la clave anon leería los
 * secretos; la API usa `pg` con el rol propietario, que la ignora, y no se añade ninguna política.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('team_webhooks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('team_id', 'text', (col) => col.notNull().references('teams.id').onDelete('cascade'))
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('events', 'jsonb', (col) => col.notNull())
    .addColumn('secret', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex('team_webhooks_team_id_idx')
    .on('team_webhooks')
    .column('team_id')
    .execute();
  await sql`alter table team_webhooks enable row level security`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('team_webhooks').execute();
}
