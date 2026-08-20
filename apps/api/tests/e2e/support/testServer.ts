import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer } from 'socket.io';
import { AddIssue } from '../../../src/application/use-cases/AddIssue.js';
import { AuthenticateTeam } from '../../../src/application/use-cases/AuthenticateTeam.js';
import { CastVote } from '../../../src/application/use-cases/CastVote.js';
import { CreateGame } from '../../../src/application/use-cases/CreateGame.js';
import { CreateTeam } from '../../../src/application/use-cases/CreateTeam.js';
import { DeleteCustomDeck } from '../../../src/application/use-cases/DeleteCustomDeck.js';
import { GetGameState } from '../../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../../src/application/use-cases/JoinGame.js';
import { ListDecks } from '../../../src/application/use-cases/ListDecks.js';
import { RevealRound } from '../../../src/application/use-cases/RevealRound.js';
import { SaveCustomDeck } from '../../../src/application/use-cases/SaveCustomDeck.js';
import { StartVotingRound } from '../../../src/application/use-cases/StartVotingRound.js';
import { SetFinalEstimate } from '../../../src/application/use-cases/SetFinalEstimate.js';
import { TimeoutReveal } from '../../../src/application/use-cases/TimeoutReveal.js';
import { UpdateCustomDeck } from '../../../src/application/use-cases/UpdateCustomDeck.js';
import { UpdateGameSettings } from '../../../src/application/use-cases/UpdateGameSettings.js';
import { registerGameRoutes } from '../../../src/infrastructure/http/routes/games.js';
import { registerTeamRoutes } from '../../../src/infrastructure/http/routes/teams.js';
import { UuidGenerator } from '../../../src/infrastructure/ids/UuidGenerator.js';
import { InMemoryDeckRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryDeckRepository.js';
import { InMemoryGameRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { InMemoryTeamRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryTeamRepository.js';
import { DiscussionTimerTracker } from '../../../src/infrastructure/realtime/DiscussionTimerTracker.js';
import { GameVersionTracker } from '../../../src/infrastructure/realtime/GameVersionTracker.js';
import { registerSocketGateway } from '../../../src/infrastructure/realtime/SocketIoGateway.js';
import { SocketIoBroadcaster } from '../../../src/infrastructure/realtime/SocketIoBroadcaster.js';
import { WsEventPublisher } from '../../../src/infrastructure/realtime/WsEventPublisher.js';
import { HmacTokenHasher } from '../../../src/infrastructure/security/HmacTokenHasher.js';
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
  const teams = new InMemoryTeamRepository();
  const decks = new InMemoryDeckRepository();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const tokenHasher = new HmacTokenHasher('test-session-secret');
  const versions = new GameVersionTracker();
  const discussionTimer = new DiscussionTimerTracker();

  const io = new SocketIoServer(app.server);
  const broadcaster = new SocketIoBroadcaster(io);
  const events = new WsEventPublisher(games, broadcaster, versions);

  const createGame = new CreateGame(games, decks, teams, events, clock, ids);
  const joinGame = new JoinGame(games, events, clock, ids);
  const addIssue = new AddIssue(games, events, clock, ids);
  const startVotingRound = new StartVotingRound(games, events, clock, ids);
  const castVote = new CastVote(games, events, clock);
  const revealRound = new RevealRound(games, events, clock);
  const timeoutReveal = new TimeoutReveal(games, events, clock);
  const setFinalEstimate = new SetFinalEstimate(games, events, clock);
  const updateGameSettings = new UpdateGameSettings(games, events, clock);
  const getGameState = new GetGameState(games);

  const createTeam = new CreateTeam(teams, tokenHasher, ids);
  const authenticateTeam = new AuthenticateTeam(teams, tokenHasher);
  const listDecks = new ListDecks(decks, teams);
  const saveCustomDeck = new SaveCustomDeck(decks, teams, tokenHasher, ids);
  const updateCustomDeck = new UpdateCustomDeck(decks, teams, tokenHasher);
  const deleteCustomDeck = new DeleteCustomDeck(decks, teams, tokenHasher);

  registerGameRoutes(app, {
    createGame,
    joinGame,
    addIssue,
    getGameState,
    updateGameSettings,
    versions,
  });
  registerTeamRoutes(app, {
    createTeam,
    authenticateTeam,
    listDecks,
    saveCustomDeck,
    updateCustomDeck,
    deleteCustomDeck,
  });
  registerSocketGateway(io, {
    getGameState,
    castVote,
    startVotingRound,
    revealRound,
    timeoutReveal,
    setFinalEstimate,
    versions,
    games,
    discussionTimer,
    clock,
  });

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
