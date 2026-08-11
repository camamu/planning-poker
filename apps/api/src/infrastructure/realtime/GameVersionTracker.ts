import type { GameId } from '../../domain/game/ids.js';

/**
 * Contador de versión en memoria por partida (docs/01-especificacion.md §6.2): cada mensaje
 * WS lleva la versión vigente tras el cambio que lo originó, y el cliente que detecta un salto
 * pide `state_sync`. Vive en memoria, no en el agregado: no es un hecho de negocio, es un detalle
 * de la entrega en tiempo real, y con una sola instancia (§8.2) no hace falta más que esto.
 */
export class GameVersionTracker {
  private readonly versions = new Map<string, number>();

  next(gameId: GameId): number {
    const version = this.current(gameId) + 1;
    this.versions.set(gameId.value, version);
    return version;
  }

  current(gameId: GameId): number {
    return this.versions.get(gameId.value) ?? 0;
  }
}
