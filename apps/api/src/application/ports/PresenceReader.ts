import type { GameId, ParticipantId } from '../../domain/game/ids.js';

/**
 * Quién está conectado a una partida. No es un hecho de negocio y no se persiste (ver
 * docs/adr/0015-presencia-y-salida-de-participantes.md): se reconstruye a partir de los sockets,
 * así que el dominio solo recibe el resultado como dato.
 */
export interface PresenceReader {
  /** Conectados ahora mismo, incluido el margen de gracia de una reconexión. Solo para mostrar. */
  onlineParticipants(gameId: GameId): ReadonlyArray<ParticipantId>;

  /**
   * Presencia con la que se puede decidir una regla (auto-revelado). `undefined` = todavía no se
   * sabe, p. ej. justo tras arrancar la API, cuando los clientes aún no han vuelto a conectarse:
   * entonces cuenta todo el mundo, para no revelar con el voto de quien llegó primero.
   */
  votingPresence(gameId: GameId): ReadonlyArray<ParticipantId> | undefined;
}

/** Sin seguimiento de presencia: nadie se descarta de los recuentos. */
export const UNKNOWN_PRESENCE: PresenceReader = {
  onlineParticipants: () => [],
  votingPresence: () => undefined,
};
