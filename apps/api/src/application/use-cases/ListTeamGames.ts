import type { TeamGameView } from '@pp/contracts';
import type { GameHistoryReader } from '../ports/GameHistoryReader.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';

export interface ListTeamGamesCommand {
  readonly slug: string;
  readonly token: string;
  readonly limit: number;
  readonly before?: Date | undefined;
}

/** `GET /api/teams/:slug/games` — el histórico es del equipo y lo abre el mismo token que su página. */
export class ListTeamGames {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly history: GameHistoryReader,
  ) {}

  async execute(command: ListTeamGamesCommand): Promise<ReadonlyArray<TeamGameView>> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    const games = await this.history.listTeamGames(team.id, {
      limit: command.limit,
      before: command.before,
    });
    return games.map((game) => ({
      id: game.id,
      name: game.name,
      createdAt: game.createdAt.toISOString(),
      issueCount: game.issueCount,
      estimatedCount: game.estimatedCount,
      participantCount: game.participantCount,
    }));
  }
}
