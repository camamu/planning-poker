import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Supabase expone el esquema `public` por PostgREST a cualquiera con la URL del proyecto y la
 * clave anon; sin RLS, esa clave lee y escribe todo (advisor `rls_disabled_in_public`). La API no
 * usa PostgREST sino `pg` con el rol propietario, que ignora RLS, así que activarla sin políticas
 * cierra el acceso de `anon`/`authenticated` sin tocar el comportamiento de la app. No se añade
 * ninguna política a propósito: el único cliente legítimo es la API.
 */
const TABLES = [
  'games',
  'participants',
  'issues',
  'rounds',
  'votes',
  'teams',
  'decks',
  'kysely_migration',
  'kysely_migration_lock',
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await sql`alter table ${sql.table(table)} enable row level security`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await sql`alter table ${sql.table(table)} disable row level security`.execute(db);
  }
}
