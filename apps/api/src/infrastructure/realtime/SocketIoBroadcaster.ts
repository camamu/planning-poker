import type { ServerEvent } from '@pp/contracts';
import type { Server } from 'socket.io';
import type { RealtimeBroadcaster } from '../../application/ports/RealtimeBroadcaster.js';
import type { GameId } from '../../domain/game/ids.js';
import { gameRoom } from './gameRoom.js';

export class SocketIoBroadcaster implements RealtimeBroadcaster {
  constructor(private readonly io: Server) {}

  broadcastToGame(gameId: GameId, event: ServerEvent): Promise<void> {
    this.io.to(gameRoom(gameId)).emit(event.type, event);
    return Promise.resolve();
  }
}
