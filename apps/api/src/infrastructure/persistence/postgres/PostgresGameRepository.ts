import type { Kysely } from 'kysely';
import type { GameRepository, GameSummary } from '../../../application/ports/GameRepository.js';
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
      this.db
        .selectFrom('participants')
        .selectAll()
        .where('game_id', '=', id.value)
        .orderBy('position', 'asc')
        .execute(),
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
            allow_vote_change: gameRow.allow_vote_change,
            celebrate: gameRow.celebrate,
            throw_emojis: gameRow.throw_emojis,
            countdown_seconds: gameRow.countdown_seconds,
            reveal_on_timeout: gameRow.reveal_on_timeout,
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

  async listSummaries(): Promise<ReadonlyArray<GameSummary>> {
    const rows = await this.db
      .selectFrom('games')
      .select((eb) => [
        'games.id',
        'games.name',
        'games.team_id',
        'games.created_at',
        eb
          .selectFrom('participants')
          .select((sub) => sub.fn.countAll<string>().as('count'))
          .whereRef('participants.game_id', '=', 'games.id')
          .as('participant_count'),
        eb
          .selectFrom('issues')
          .select((sub) => sub.fn.countAll<string>().as('count'))
          .whereRef('issues.game_id', '=', 'games.id')
          .as('issue_count'),
        eb
          .selectFrom('issues')
          .select((sub) => sub.fn.countAll<string>().as('count'))
          .whereRef('issues.game_id', '=', 'games.id')
          .where('issues.status', '=', 'ESTIMATED')
          .as('estimated_issue_count'),
      ])
      .orderBy('games.created_at', 'desc')
      .execute();

    // `count(*)` llega como string (bigint en pg) y el subselect escalar se tipa como nullable.
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.team_id,
      participantCount: Number(row.participant_count ?? 0),
      issueCount: Number(row.issue_count ?? 0),
      estimatedIssueCount: Number(row.estimated_issue_count ?? 0),
      createdAt: row.created_at,
    }));
  }

  /** Participantes, issues, rondas y votos caen por las FK en cascada de la migración 0001. */
  async delete(id: GameId): Promise<void> {
    await this.db.deleteFrom('games').where('id', '=', id.value).execute();
  }
}
