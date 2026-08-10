import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('games')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('deck', 'jsonb', (col) => col.notNull())
    .addColumn('auto_reveal', 'boolean', (col) => col.notNull())
    .addColumn('who_can_reveal', 'text', (col) => col.notNull())
    .addColumn('named_revealers', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'games_who_can_reveal_check',
      sql`who_can_reveal in ('FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST')`,
    )
    .execute();

  await db.schema
    .createTable('participants')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('display_name', 'text', (col) => col.notNull())
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('is_facilitator', 'boolean', (col) => col.notNull())
    .addCheckConstraint('participants_role_check', sql`role in ('VOTER', 'SPECTATOR')`)
    .execute();
  await db.schema
    .createIndex('participants_game_id_idx')
    .on('participants')
    .column('game_id')
    .execute();

  await db.schema
    .createTable('issues')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('external_url', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('final_estimate_raw', 'text')
    .addUniqueConstraint('issues_game_id_position_key', ['game_id', 'position'])
    .addCheckConstraint('issues_status_check', sql`status in ('PENDING', 'VOTING', 'ESTIMATED')`)
    .execute();
  await db.schema.createIndex('issues_game_id_idx').on('issues').column('game_id').execute();

  await db.schema
    .createTable('rounds')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('game_id', 'text', (col) => col.notNull().references('games.id').onDelete('cascade'))
    .addColumn('issue_id', 'text', (col) =>
      col.notNull().references('issues.id').onDelete('cascade'),
    )
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('round_number', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('revealed_at', 'timestamptz')
    .addUniqueConstraint('rounds_game_id_position_key', ['game_id', 'position'])
    .addCheckConstraint('rounds_status_check', sql`status in ('OPEN', 'REVEALED', 'CLOSED')`)
    .execute();
  await db.schema.createIndex('rounds_game_id_idx').on('rounds').column('game_id').execute();
  await db.schema.createIndex('rounds_issue_id_idx').on('rounds').column('issue_id').execute();

  await db.schema
    .createTable('votes')
    .addColumn('round_id', 'text', (col) =>
      col.notNull().references('rounds.id').onDelete('cascade'),
    )
    .addColumn('participant_id', 'text', (col) =>
      col.notNull().references('participants.id').onDelete('cascade'),
    )
    .addColumn('card_raw', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('votes_pkey', ['round_id', 'participant_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('votes').execute();
  await db.schema.dropTable('rounds').execute();
  await db.schema.dropTable('issues').execute();
  await db.schema.dropTable('participants').execute();
  await db.schema.dropTable('games').execute();
}
