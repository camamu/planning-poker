import type { Kysely } from 'kysely';
import type { GameRepository } from '../../../application/ports/GameRepository.js';
import type { Game } from '../../../domain/game/Game.js';
import type { GameId } from '../../../domain/game/ids.js';
import {
  toDomainGame,
  toGameRow,
  toIssueRows,
  toParticipantRows,
  toRoundRows,
  toVoteRows,
} from './mappers/GameMapper.js';
import type { Database } from './schema.js';

export class PostgresGameRepository implements GameRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: GameId): Promise<Game | undefined> {
    const gameRow = await this.db
      .selectFrom('games')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    if (!gameRow) return undefined;

    const [participants, issues, rounds] = await Promise.all([
      this.db.selectFrom('participants').selectAll().where('game_id', '=', id.value).execute(),
      this.db
        .selectFrom('issues')
        .selectAll()
        .where('game_id', '=', id.value)
        .orderBy('position', 'asc')
        .execute(),
      this.db
        .selectFrom('rounds')
        .selectAll()
        .where('game_id', '=', id.value)
        .orderBy('position', 'asc')
        .execute(),
    ]);

    const roundIds = rounds.map((round) => round.id);
    const votes =
      roundIds.length === 0
        ? []
        : await this.db.selectFrom('votes').selectAll().where('round_id', 'in', roundIds).execute();

    return toDomainGame({ game: gameRow, participants, issues, rounds, votes });
  }

  async save(game: Game): Promise<void> {
    const gameRow = toGameRow(game);
    const participantRows = toParticipantRows(game);
    const issueRows = toIssueRows(game);
    const roundRows = toRoundRows(game);
    const voteRows = toVoteRows(game);

    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('games')
        .values(gameRow)
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            name: gameRow.name,
            deck: gameRow.deck,
            auto_reveal: gameRow.auto_reveal,
            who_can_reveal: gameRow.who_can_reveal,
            named_revealers: gameRow.named_revealers,
          }),
        )
        .execute();

      // El aggregate completo se reescribe en cada save: rounds cascadea a votes por FK,
      // así que borrar en este orden (rounds -> issues -> participants) basta.
      await trx.deleteFrom('rounds').where('game_id', '=', game.id.value).execute();
      await trx.deleteFrom('issues').where('game_id', '=', game.id.value).execute();
      await trx.deleteFrom('participants').where('game_id', '=', game.id.value).execute();

      if (participantRows.length > 0) {
        await trx.insertInto('participants').values(participantRows).execute();
      }
      if (issueRows.length > 0) {
        await trx.insertInto('issues').values(issueRows).execute();
      }
      if (roundRows.length > 0) {
        await trx.insertInto('rounds').values(roundRows).execute();
      }
      if (voteRows.length > 0) {
        await trx.insertInto('votes').values(voteRows).execute();
      }
    });
  }
}
