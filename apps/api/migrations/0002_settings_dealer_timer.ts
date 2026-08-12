import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Bloque 6 (docs/adr/0005-extension-de-alcance-bloque-6.md): los cuatro ajustes nuevos de
 * `GameSettings`, `who_can_reveal: 'DEALER'`, el orden de entrada de los participantes (base del
 * cálculo del dealer) y la fecha límite de la cuenta atrás por ronda (F5).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('games')
    .addColumn('allow_vote_change', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('celebrate', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('throw_emojis', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('countdown_seconds', 'integer')
    .addColumn('reveal_on_timeout', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema.alterTable('games').dropConstraint('games_who_can_reveal_check').execute();
  await db.schema
    .alterTable('games')
    .addCheckConstraint(
      'games_who_can_reveal_check',
      sql`who_can_reveal in ('FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST', 'DEALER')`,
    )
    .execute();

  // `not null` en dos pasos porque las filas existentes no tienen valor todavía.
  await db.schema.alterTable('participants').addColumn('position', 'integer').execute();
  await sql`update participants set position = 0 where position is null`.execute(db);
  await db.schema
    .alterTable('participants')
    .alterColumn('position', (col) => col.setNotNull())
    .execute();

  await db.schema.alterTable('rounds').addColumn('timer_deadline', 'timestamptz').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('rounds').dropColumn('timer_deadline').execute();
  await db.schema.alterTable('participants').dropColumn('position').execute();

  await db.schema.alterTable('games').dropConstraint('games_who_can_reveal_check').execute();
  await db.schema
    .alterTable('games')
    .addCheckConstraint(
      'games_who_can_reveal_check',
      sql`who_can_reveal in ('FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST')`,
    )
    .execute();

  await db.schema
    .alterTable('games')
    .dropColumn('allow_vote_change')
    .dropColumn('celebrate')
    .dropColumn('throw_emojis')
    .dropColumn('countdown_seconds')
    .dropColumn('reveal_on_timeout')
    .execute();
}
