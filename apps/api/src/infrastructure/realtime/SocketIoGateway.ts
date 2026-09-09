import {
  wsDiscussionTimerControlCommandSchema,
  wsEmojiThrownCommandSchema,
  wsJoinCommandSchema,
  wsRevealCommandSchema,
  wsSetEstimateCommandSchema,
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
import type { SetFinalEstimate } from '../../application/use-cases/SetFinalEstimate.js';
import type { TimeoutReveal } from '../../application/use-cases/TimeoutReveal.js';
import type { GameRepository } from '../../application/ports/GameRepository.js';
import { DomainError } from '../../domain/shared/DomainError.js';
import type { Clock } from '../../domain/shared/Clock.js';
import { GameId } from '../../domain/game/ids.js';
import type { DiscussionTimerTracker } from './DiscussionTimerTracker.js';
import { gameRoom } from './gameRoom.js';
import type { GameVersionTracker } from './GameVersionTracker.js';

export interface SocketGatewayDependencies {
  readonly getGameState: GetGameState;
  readonly castVote: CastVote;
  readonly startVotingRound: StartVotingRound;
  readonly revealRound: RevealRound;
  readonly timeoutReveal: TimeoutReveal;
  readonly setFinalEstimate: SetFinalEstimate;
  readonly versions: GameVersionTracker;
  /** Solo lectura, para comprobar `settings.throwEmojis` antes de reenviar un emoji. */
  readonly games: GameRepository;
  readonly discussionTimer: DiscussionTimerTracker;
  readonly clock: Clock;
}

/**
 * `join` no pasa por `WsEventPublisher`: es una respuesta directa a quien pregunta, no un hecho
 * de negocio que haya que repartir a toda la room. `vote`/`start_round`/`reveal`/`timeout_reveal`
 * sí — invocan el mismo caso de uso que usaría REST, y es `WsEventPublisher` quien reparte lo que
 * resulte. `emoji_thrown` y `discussion_timer_control` tampoco pasan por ningún caso de uso: no
 * son un hecho de negocio del agregado `Game` (docs/adr/0005-extension-de-alcance-bloque-6.md) —
 * la gateway los reenvía directamente, igual que hace `join` con `state_sync`.
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

        const roundId = state.currentRound?.id;
        const timer = roundId ? deps.discussionTimer.current(roundId, deps.clock.now()) : null;
        if (roundId && timer) {
          socket.emit('discussion_timer_sync', {
            type: 'discussion_timer_sync',
            roundId,
            running: timer.running,
            remainingMs: timer.remainingMs,
          });
        }
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

    socket.on('timeout_reveal', (payload: unknown) => {
      void handle(socket, async () => {
        await deps.timeoutReveal.execute(wsRevealCommandSchema.parse(payload));
      });
    });

    socket.on('set_estimate', (payload: unknown) => {
      void handle(socket, async () => {
        await deps.setFinalEstimate.execute(wsSetEstimateCommandSchema.parse(payload));
      });
    });

    socket.on('emoji_thrown', (payload: unknown) => {
      void handle(socket, async () => {
        const command = wsEmojiThrownCommandSchema.parse(payload);
        const gameId = GameId.of(command.gameId);
        const game = await deps.games.findById(gameId);
        if (!game?.currentSettings().throwEmojis) return;

        io.to(gameRoom(gameId)).emit('emoji_thrown', {
          type: 'emoji_thrown',
          fromParticipantId: command.participantId,
          toParticipantId: command.toParticipantId,
          emoji: command.emoji,
        });
      });
    });

    socket.on('discussion_timer_control', (payload: unknown) => {
      void handle(socket, () => {
        const command = wsDiscussionTimerControlCommandSchema.parse(payload);
        const gameId = GameId.of(command.gameId);
        const snapshot = deps.discussionTimer.apply(
          command.roundId,
          command.action,
          command.seconds,
          deps.clock.now(),
        );

        io.to(gameRoom(gameId)).emit('discussion_timer_sync', {
          type: 'discussion_timer_sync',
          roundId: command.roundId,
          running: snapshot.running,
          remainingMs: snapshot.remainingMs,
        });
      });
    });
  });
}

async function handle(socket: Socket, action: () => Promise<void> | void): Promise<void> {
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
