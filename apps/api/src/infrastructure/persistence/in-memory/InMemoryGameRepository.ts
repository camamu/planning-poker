import type { Game } from '../../../domain/game/Game.js';
import type { GameId } from '../../../domain/game/ids.js';
import type { GameRepository, GameSummary } from '../../../application/ports/GameRepository.js';

export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();
  // Equivale al `default now()` de `games.created_at`: el agregado no conoce su fecha de creación.
  private readonly createdAt = new Map<string, Date>();

  findById(id: GameId): Promise<Game | undefined> {
    return Promise.resolve(this.games.get(id.value));
  }

  save(game: Game): Promise<void> {
    this.games.set(game.id.value, game);
    if (!this.createdAt.has(game.id.value)) this.createdAt.set(game.id.value, new Date());
    return Promise.resolve();
  }

  listSummaries(): Promise<ReadonlyArray<GameSummary>> {
    // Invertido antes de ordenar: dos partidas guardadas en el mismo milisegundo empatan, y el sort
    // estable las deja entonces en orden de inserción inverso, que es "más reciente primero".
    const summaries = [...this.games.values()].reverse().map((game): GameSummary => {
      const issues = game.allIssues();
      return {
        id: game.id.value,
        name: game.currentName().value,
        teamId: game.currentTeamId()?.value ?? null,
        participantCount: game.allParticipants().length,
        issueCount: issues.length,
        estimatedIssueCount: issues.filter((issue) => issue.currentStatus() === 'ESTIMATED').length,
        createdAt: this.createdAt.get(game.id.value) ?? new Date(0),
      };
    });
    return Promise.resolve(summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  delete(id: GameId): Promise<void> {
    this.games.delete(id.value);
    this.createdAt.delete(id.value);
    return Promise.resolve();
  }
}
