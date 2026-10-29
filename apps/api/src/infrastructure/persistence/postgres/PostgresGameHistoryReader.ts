import type { Kysely } from 'kysely';
import type {
  GameHistoryReader,
  TeamGameSummary,
  TeamGamesPage,
} from '../../../application/ports/GameHistoryReader.js';
import type { TeamId } from '../../../domain/team/TeamId.js';
import type { Database } from './schema.js';

export class PostgresGameHistoryReader implements GameHistoryReader {
  constructor(private readonly db: Kysely<Database>) {}

  async listTeamGames(
    teamId: TeamId,
    { limit, before }: TeamGamesPage,
  ): Promise<ReadonlyArray<TeamGameSummary>> {
    let query = this.db
      .selectFrom('games')
      .select((eb) => [
        'games.id',
        'games.name',
        'games.created_at',
        eb
          .selectFrom('participants')
          .select((sub) => sub.fn.countAll<string>().as('count'))
          .whereRef('participants.game_id', '=', 'games.id')
          .where('participants.left', '=', false)
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
          .as('estimated_count'),
      ])
      .where('games.team_id', '=', teamId.value);

    if (before !== undefined) query = query.where('games.created_at', '<', before);

    const rows = await query
      .orderBy('games.created_at', 'desc')
      .orderBy('games.id', 'desc')
      .limit(limit)
      .execute();

    // `count(*)` llega como string (bigint en pg) y el subselect escalar se tipa como nullable.
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      issueCount: Number(row.issue_count ?? 0),
      estimatedCount: Number(row.estimated_count ?? 0),
      participantCount: Number(row.participant_count ?? 0),
    }));
  }
}
