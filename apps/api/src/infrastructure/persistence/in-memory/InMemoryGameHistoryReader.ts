import type {
  GameHistoryReader,
  TeamGameSummary,
  TeamGamesPage,
} from '../../../application/ports/GameHistoryReader.js';
import type { GameRepository } from '../../../application/ports/GameRepository.js';
import type { TeamId } from '../../../domain/team/TeamId.js';

/** Se apoya en `listSummaries()` para no duplicar el recuento de tareas y participantes. */
export class InMemoryGameHistoryReader implements GameHistoryReader {
  constructor(private readonly games: GameRepository) {}

  async listTeamGames(
    teamId: TeamId,
    { limit, before }: TeamGamesPage,
  ): Promise<ReadonlyArray<TeamGameSummary>> {
    const summaries = await this.games.listSummaries();
    return summaries
      .filter(
        (summary) =>
          summary.teamId === teamId.value &&
          (before === undefined || summary.createdAt.getTime() < before.getTime()),
      )
      .slice(0, limit)
      .map((summary) => ({
        id: summary.id,
        name: summary.name,
        createdAt: summary.createdAt,
        issueCount: summary.issueCount,
        estimatedCount: summary.estimatedIssueCount,
        participantCount: summary.participantCount,
      }));
  }
}
