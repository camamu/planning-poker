import type { Kysely } from 'kysely';
import type { DeckRepository } from '../../../application/ports/DeckRepository.js';
import type { SavedDeck } from '../../../domain/deck/SavedDeck.js';
import type { DeckId } from '../../../domain/deck/DeckId.js';
import type { TeamId } from '../../../domain/team/TeamId.js';
import { toDeckRow, toDomainDeck } from './mappers/DeckMapper.js';
import type { Database } from './schema.js';

export class PostgresDeckRepository implements DeckRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: DeckId): Promise<SavedDeck | undefined> {
    const row = await this.db
      .selectFrom('decks')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? toDomainDeck(row) : undefined;
  }

  async listAvailableFor(teamId: TeamId | null): Promise<ReadonlyArray<SavedDeck>> {
    const rows = await this.db
      .selectFrom('decks')
      .selectAll()
      .where((eb) =>
        teamId === null
          ? eb('team_id', 'is', null)
          : eb.or([eb('team_id', 'is', null), eb('team_id', '=', teamId.value)]),
      )
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map(toDomainDeck);
  }

  async save(deck: SavedDeck): Promise<void> {
    const row = toDeckRow(deck);
    await this.db
      .insertInto('decks')
      .values(row)
      .onConflict((oc) => oc.column('id').doUpdateSet({ name: row.name, cards: row.cards }))
      .execute();
  }

  async delete(id: DeckId): Promise<void> {
    await this.db.deleteFrom('decks').where('id', '=', id.value).execute();
  }
}
