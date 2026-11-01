import type { TeamId } from '../../domain/team/TeamId.js';

/** Una fila del histórico: solo lo que hace falta para listar, sin reconstruir el agregado. */
export interface TeamGameSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly issueCount: number;
  readonly estimatedCount: number;
  /** Sin contar a quienes ya han salido de la partida. */
  readonly participantCount: number;
}

export interface TeamGamesPage {
  readonly limit: number;
  /** Solo las creadas estrictamente antes de este instante: el `createdAt` de la última fila vista. */
  readonly before?: Date | undefined;
}

/**
 * Puerto de consulta, no un método de `GameRepository`: listar partidas no es una operación sobre
 * un agregado y reconstruir cada `Game` con sus rondas y votos para mostrar un nombre y dos
 * contadores no aporta ninguna invariante (docs/adr/0024-tiempos-e-historico.md).
 */
export interface GameHistoryReader {
  /** Más recientes primero. */
  listTeamGames(teamId: TeamId, page: TeamGamesPage): Promise<ReadonlyArray<TeamGameSummary>>;
}
