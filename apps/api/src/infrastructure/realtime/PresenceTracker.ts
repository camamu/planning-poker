import type { PresenceReader } from '../../application/ports/PresenceReader.js';
import { ParticipantId } from '../../domain/game/ids.js';
import type { GameId } from '../../domain/game/ids.js';
import type { Clock } from '../../domain/shared/Clock.js';

export interface PresenceChange {
  readonly gameId: string;
  readonly participantId: string;
  readonly online: boolean;
}

export type PresenceListener = (change: PresenceChange) => void;

export interface PresenceTrackerOptions {
  /** Cuánto se espera tras perder el último socket de alguien antes de darlo por desconectado. */
  readonly graceMs: number;
  /** Tras arrancar, durante este tiempo `votingPresence` no se fía: los clientes aún reconectan. */
  readonly warmupMs: number;
}

interface SocketEntry {
  readonly gameId: string;
  readonly participantId: string;
}

/**
 * Presencia en memoria (docs/adr/0015-presencia-y-salida-de-participantes.md): no es un hecho de
 * negocio ni se persiste, igual que `GameVersionTracker`. Una persona está "conectada" mientras
 * tenga algún socket unido a la partida o dentro del margen de gracia posterior a perder el
 * último, para que un corte de red breve o un cambio de pestaña en el móvil no la desconecten.
 */
export class PresenceTracker implements PresenceReader {
  private readonly sockets = new Map<string, SocketEntry>();
  private readonly socketsByParticipant = new Map<string, Set<string>>();
  private readonly onlineByGame = new Map<string, Set<string>>();
  private readonly pendingOffline = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly bootedAt: number;
  private listener: PresenceListener = () => undefined;

  constructor(
    private readonly clock: Clock,
    private readonly options: PresenceTrackerOptions,
  ) {
    this.bootedAt = clock.now().getTime();
  }

  onChange(listener: PresenceListener): void {
    this.listener = listener;
  }

  connect(socketId: string, gameId: string, participantId: string): void {
    this.disconnect(socketId);
    this.sockets.set(socketId, { gameId, participantId });

    const key = keyOf(gameId, participantId);
    const sockets = this.socketsByParticipant.get(key) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByParticipant.set(key, sockets);

    this.cancelPendingOffline(key);
    const online = this.onlineByGame.get(gameId) ?? new Set<string>();
    this.onlineByGame.set(gameId, online);
    if (!online.has(participantId)) {
      online.add(participantId);
      this.listener({ gameId, participantId, online: true });
    }
  }

  disconnect(socketId: string): void {
    const entry = this.sockets.get(socketId);
    if (!entry) return;
    this.sockets.delete(socketId);

    const key = keyOf(entry.gameId, entry.participantId);
    const sockets = this.socketsByParticipant.get(key);
    sockets?.delete(socketId);
    if (sockets && sockets.size > 0) return;

    this.socketsByParticipant.delete(key);
    const timer = setTimeout(() => {
      this.pendingOffline.delete(key);
      this.markOffline(entry);
    }, this.options.graceMs);
    timer.unref();
    this.pendingOffline.set(key, timer);
  }

  onlineParticipants(gameId: GameId): ReadonlyArray<ParticipantId> {
    return [...(this.onlineByGame.get(gameId.value) ?? [])].map((id) => ParticipantId.of(id));
  }

  votingPresence(gameId: GameId): ReadonlyArray<ParticipantId> | undefined {
    if (this.clock.now().getTime() - this.bootedAt < this.options.warmupMs) return undefined;
    return this.onlineParticipants(gameId);
  }

  private markOffline(entry: SocketEntry): void {
    const online = this.onlineByGame.get(entry.gameId);
    if (!online?.delete(entry.participantId)) return;
    this.listener({ gameId: entry.gameId, participantId: entry.participantId, online: false });
  }

  private cancelPendingOffline(key: string): void {
    const timer = this.pendingOffline.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.pendingOffline.delete(key);
  }
}

function keyOf(gameId: string, participantId: string): string {
  return `${gameId}:${participantId}`;
}
