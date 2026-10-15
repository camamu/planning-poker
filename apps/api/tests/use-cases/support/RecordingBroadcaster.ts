import type { ServerEvent } from '@pp/contracts';
import type { RealtimeBroadcaster } from '../../../src/application/ports/RealtimeBroadcaster.js';
import type { GameId } from '../../../src/domain/game/ids.js';

export class RecordingBroadcaster implements RealtimeBroadcaster {
  readonly broadcasts: Array<{ gameId: string; event: ServerEvent }> = [];
  readonly closedGameIds: string[] = [];

  broadcastToGame(gameId: GameId, event: ServerEvent): Promise<void> {
    this.broadcasts.push({ gameId: gameId.value, event });
    return Promise.resolve();
  }

  closeGame(gameId: GameId): Promise<void> {
    this.closedGameIds.push(gameId.value);
    return Promise.resolve();
  }
}
