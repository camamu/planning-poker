import type { GameSummaryResponseView } from '@pp/contracts';
import { GameId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { toGameSummaryView } from '../read-models/toGameSummaryView.js';
import { loadGame } from './loadGame.js';

/** Cualquiera con el enlace de la partida puede ver su resumen, igual que la propia partida (ADR 0025). */
export class GetGameSummary {
  constructor(
    private readonly games: GameRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(query: { readonly gameId: string }): Promise<GameSummaryResponseView> {
    const game = await loadGame(this.games, GameId.of(query.gameId));
    const teamId = game.currentTeamId();
    const team = teamId ? await this.teams.findById(teamId) : undefined;
    return {
      ...toGameSummaryView(game),
      canSendToTeam: (team?.webhooksFor('session.summary').length ?? 0) > 0,
    };
  }
}
