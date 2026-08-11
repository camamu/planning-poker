import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { Server as SocketIoServer } from 'socket.io';
import { AddIssue } from './application/use-cases/AddIssue.js';
import { CastVote } from './application/use-cases/CastVote.js';
import { CreateGame } from './application/use-cases/CreateGame.js';
import { GetGameState } from './application/use-cases/GetGameState.js';
import { JoinGame } from './application/use-cases/JoinGame.js';
import { RevealRound } from './application/use-cases/RevealRound.js';
import { StartVotingRound } from './application/use-cases/StartVotingRound.js';
import { TimeoutReveal } from './application/use-cases/TimeoutReveal.js';
import { UpdateGameSettings } from './application/use-cases/UpdateGameSettings.js';
import { loadEnv } from './infrastructure/config/env.js';
import { registerGameRoutes } from './infrastructure/http/routes/games.js';
import { registerHealthRoutes } from './infrastructure/http/routes/health.js';
import { UuidGenerator } from './infrastructure/ids/UuidGenerator.js';
import { createDb } from './infrastructure/persistence/postgres/db.js';
import { PostgresGameRepository } from './infrastructure/persistence/postgres/PostgresGameRepository.js';
import { DiscussionTimerTracker } from './infrastructure/realtime/DiscussionTimerTracker.js';
import { GameVersionTracker } from './infrastructure/realtime/GameVersionTracker.js';
import { registerSocketGateway } from './infrastructure/realtime/SocketIoGateway.js';
import { SocketIoBroadcaster } from './infrastructure/realtime/SocketIoBroadcaster.js';
import { WsEventPublisher } from './infrastructure/realtime/WsEventPublisher.js';
import { SystemClock } from './infrastructure/time/SystemClock.js';

const env = loadEnv();

const app = Fastify({ logger: { level: env.LOG_LEVEL } });
const pool = new Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (error) => {
  app.log.error(error, 'error inesperado en un cliente idle del pool de postgres');
});

const db = createDb(pool);
const games = new PostgresGameRepository(db);
const clock = new SystemClock();
const ids = new UuidGenerator();
const versions = new GameVersionTracker();
const discussionTimer = new DiscussionTimerTracker();

await app.register(cors, { origin: env.CORS_ORIGIN });
registerHealthRoutes(app, pool);

const io = new SocketIoServer(app.server, { cors: { origin: env.CORS_ORIGIN } });
const broadcaster = new SocketIoBroadcaster(io);
const events = new WsEventPublisher(games, broadcaster, versions);

const createGame = new CreateGame(games, events, clock, ids);
const joinGame = new JoinGame(games, events, clock, ids);
const addIssue = new AddIssue(games, events, clock, ids);
const startVotingRound = new StartVotingRound(games, events, clock, ids);
const castVote = new CastVote(games, events, clock);
const revealRound = new RevealRound(games, events, clock);
const timeoutReveal = new TimeoutReveal(games, events, clock);
const updateGameSettings = new UpdateGameSettings(games, events, clock);
const getGameState = new GetGameState(games);

registerGameRoutes(app, {
  createGame,
  joinGame,
  addIssue,
  getGameState,
  updateGameSettings,
  versions,
});
registerSocketGateway(io, {
  getGameState,
  castVote,
  startVotingRound,
  revealRound,
  timeoutReveal,
  versions,
  games,
  discussionTimer,
  clock,
});

app.addHook('onClose', async () => {
  await io.close();
  await db.destroy();
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });
