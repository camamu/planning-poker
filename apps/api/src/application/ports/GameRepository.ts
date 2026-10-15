import type { Game } from '../../domain/game/Game.js';
import type { GameId } from '../../domain/game/ids.js';

/**
 * Lectura plana para el panel de gestión: cargar cada agregado entero (participantes, issues,
 * rondas y votos) solo para contar filas no escala con el número de salas.
 */
export interface GameSummary {
  readonly id: string;
  readonly name: string;
  readonly teamId: string | null;
  readonly participantCount: number;
  readonly issueCount: number;
  readonly estimatedIssueCount: number;
  readonly createdAt: Date;
}

export interface GameRepository {
  findById(id: GameId): Promise<Game | undefined>;
  save(game: Game): Promise<void>;
  /** Más recientes primero. */
  listSummaries(): Promise<ReadonlyArray<GameSummary>>;
  delete(id: GameId): Promise<void>;
}
