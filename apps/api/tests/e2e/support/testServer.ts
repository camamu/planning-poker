import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer } from 'socket.io';
import { AddIssue } from '../../../src/application/use-cases/AddIssue.js';
import { CastVote } from '../../../src/application/use-cases/CastVote.js';
import { CreateGame } from '../../../src/application/use-cases/CreateGame.js';
import { GetGameState } from '../../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../../src/application/use-cases/RevealRound.js';
import { StartVotingRound } from '../../../src/application/use-cases/StartVotingRound.js';
import { registerGameRoutes } from '../../../src/infrastructure/http/routes/games.js';
import { UuidGenerator } from '../../../src/infrastructure/ids/UuidGenerator.js';
import { InMemoryGameRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { GameVersionTracker } from '../../../src/infrastructure/realtime/GameVersionTracker.js';
import { registerSocketGateway } from '../../../src/infrastructure/realtime/SocketIoGateway.js';
import { SocketIoBroadcaster } from '../../../src/infrastructure/realtime/SocketIoBroadcaster.js';
import { WsEventPublisher } from '../../../src/infrastructure/realtime/WsEventPublisher.js';
import { SystemClock } from '../../../src/infrastructure/time/SystemClock.js';

export interface TestServer {
  readonly app: FastifyInstance;
  readonly baseUrl: string;
  close(): Promise<void>;
}

/**
 * Cablea el mismo stack que `main.ts` (Fastify + Socket.IO + casos de uso), pero con
 * `InMemoryGameRepository`: este test ejercita HTTP+WS de punta a punta, no la persistencia
 * (eso ya lo cubre `tests/contract` contra Postgres real).
 */
export async function startTestServer(): Promise<TestServer> {
  const app = Fastify({ logger: false });

  const games = new InMemoryGameRepository();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const versions = new GameVersionTracker();

  const io = new SocketIoServer(app.server);
  const broadcaster = new SocketIoBroadcaster(io);
  const events = new WsEventPublisher(games, broadcaster, versions);

  const createGame = new CreateGame(games, events, clock, ids);
  const joinGame = new JoinGame(games, events, clock, ids);
  const addIssue = new AddIssue(games, events, clock, ids);
  const startVotingRound = new StartVotingRound(games, events, clock, ids);
  const castVote = new CastVote(games, events, clock);
  const revealRound = new RevealRound(games, events, clock);
  const getGameState = new GetGameState(games);

  registerGameRoutes(app, { createGame, joinGame, addIssue, getGameState, versions });
  registerSocketGateway(io, { getGameState, castVote, startVotingRound, revealRound, versions });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No se pudo determinar el puerto del servidor de test.');
  }

  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port.toString()}`,
    close: async () => {
      await io.close();
      await app.close();
    },
  };
}
