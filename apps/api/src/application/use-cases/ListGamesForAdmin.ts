import type { AdminGameView } from '@pp/contracts';
import type { GameRepository } from '../ports/GameRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { teamRefResolver } from '../read-models/teamRefResolver.js';

export class ListGamesForAdmin {
  constructor(
    private readonly games: GameRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(): Promise<ReadonlyArray<AdminGameView>> {
    const [summaries, teams] = await Promise.all([
      this.games.listSummaries(),
      this.teams.listAll(),
    ]);
    const teamRef = teamRefResolver(teams);
    return summaries.map((summary) => ({
      id: summary.id,
      name: summary.name,
      team: teamRef(summary.teamId),
      participantCount: summary.participantCount,
      issueCount: summary.issueCount,
      estimatedIssueCount: summary.estimatedIssueCount,
      createdAt: summary.createdAt.toISOString(),
    }));
  }
}
