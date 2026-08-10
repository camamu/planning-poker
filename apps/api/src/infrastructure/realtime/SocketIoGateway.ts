import {
  wsJoinCommandSchema,
  wsRevealCommandSchema,
  wsStartRoundCommandSchema,
  wsVoteCommandSchema,
} from '@pp/contracts';
import type { Server, Socket } from 'socket.io';
import { ZodError } from 'zod';
import type { CastVote } from '../../application/use-cases/CastVote.js';
import type { GetGameState } from '../../application/use-cases/GetGameState.js';
import { GameNotFoundError } from '../../application/use-cases/GameNotFoundError.js';
import type { RevealRound } from '../../application/use-cases/RevealRound.js';
import type { StartVotingRound } from '../../application/use-cases/StartVotingRound.js';
import { DomainError } from '../../domain/shared/DomainError.js';
import { GameId } from '../../domain/game/ids.js';
import { gameRoom } from './gameRoom.js';
import type { GameVersionTracker } from './GameVersionTracker.js';

export interface SocketGatewayDependencies {
  readonly getGameState: GetGameState;
  readonly castVote: CastVote;
  readonly startVotingRound: StartVotingRound;
  readonly revealRound: RevealRound;
  readonly versions: GameVersionTracker;
}

/**
 * `join` no pasa por `WsEventPublisher`: es una respuesta directa a quien pregunta, no un hecho
 * de negocio que haya que repartir a toda la room. `vote`/`start_round`/`reveal` sí — invocan el
 * mismo caso de uso que usaría REST, y es `WsEventPublisher` quien reparte lo que resulte.
 */
export function registerSocketGateway(io: Server, deps: SocketGatewayDependencies): void {
  io.on('connection', (socket) => {
    socket.on('join', (payload: unknown) => {
      void handle(socket, async () => {
        const command = wsJoinCommandSchema.parse(payload);
        const gameId = GameId.of(command.gameId);
        await socket.join(gameRoom(gameId));
        const state = await deps.getGameState.execute({
          gameId: command.gameId,
          viewerId: command.participantId,
        });
        socket.emit('state_sync', {
          type: 'state_sync',
          version: deps.versions.current(gameId),
          state,
        });
      });
    });

    socket.on('vote', (payload: unknown) => {
      void handle(socket, async () => {
        await deps.castVote.execute(wsVoteCommandSchema.parse(payload));
      });
    });

    socket.on('start_round', (payload: unknown) => {
      void handle(socket, async () => {
        await deps.startVotingRound.execute(wsStartRoundCommandSchema.parse(payload));
      });
    });

    socket.on('reveal', (payload: unknown) => {
      void handle(socket, async () => {
        await deps.revealRound.execute(wsRevealCommandSchema.parse(payload));
      });
    });
  });
}

async function handle(socket: Socket, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    socket.emit('error', { type: 'error', message: toErrorMessage(error) });
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return 'Payload inválido.';
  if (error instanceof GameNotFoundError) return error.message;
  if (error instanceof DomainError) return error.message;
  throw error;
}
