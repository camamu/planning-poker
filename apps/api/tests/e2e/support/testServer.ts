import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIoServer } from 'socket.io';
import { AddIssue } from '../../../src/application/use-cases/AddIssue.js';
import { AuthenticateTeam } from '../../../src/application/use-cases/AuthenticateTeam.js';
import { CastVote } from '../../../src/application/use-cases/CastVote.js';
import { ChangeGameDeck } from '../../../src/application/use-cases/ChangeGameDeck.js';
import { CreateGame } from '../../../src/application/use-cases/CreateGame.js';
import { CreateTeam } from '../../../src/application/use-cases/CreateTeam.js';
import { DeleteCustomDeck } from '../../../src/application/use-cases/DeleteCustomDeck.js';
import { DeleteDeckAsAdmin } from '../../../src/application/use-cases/DeleteDeckAsAdmin.js';
import { DeleteGame } from '../../../src/application/use-cases/DeleteGame.js';
import { DeleteTeam } from '../../../src/application/use-cases/DeleteTeam.js';
import { GetGameState } from '../../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../../src/application/use-cases/JoinGame.js';
import { ListDecks } from '../../../src/application/use-cases/ListDecks.js';
import { ListDecksForAdmin } from '../../../src/application/use-cases/ListDecksForAdmin.js';
import { ListGamesForAdmin } from '../../../src/application/use-cases/ListGamesForAdmin.js';
import { ListTeamsForAdmin } from '../../../src/application/use-cases/ListTeamsForAdmin.js';
import { LogInAdmin } from '../../../src/application/use-cases/LogInAdmin.js';
import { RegenerateTeamToken } from '../../../src/application/use-cases/RegenerateTeamToken.js';
import { RenameTeam } from '../../../src/application/use-cases/RenameTeam.js';
import { ListGameDecks } from '../../../src/application/use-cases/ListGameDecks.js';
import { RevealRound } from '../../../src/application/use-cases/RevealRound.js';
import { SaveCustomDeck } from '../../../src/application/use-cases/SaveCustomDeck.js';
import { StartQuickRound } from '../../../src/application/use-cases/StartQuickRound.js';
import { StartVotingRound } from '../../../src/application/use-cases/StartVotingRound.js';
import { SetFinalEstimate } from '../../../src/application/use-cases/SetFinalEstimate.js';
import { TimeoutReveal } from '../../../src/application/use-cases/TimeoutReveal.js';
import { UpdateCustomDeck } from '../../../src/application/use-cases/UpdateCustomDeck.js';
import { UpdateGameSettings } from '../../../src/application/use-cases/UpdateGameSettings.js';
import { LoginThrottle } from '../../../src/infrastructure/http/LoginThrottle.js';
import { registerAdminRoutes } from '../../../src/infrastructure/http/routes/admin.js';
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
import { HmacAdminSessions } from '../../../src/infrastructure/security/HmacAdminSessions.js';
import { HmacTokenHasher } from '../../../src/infrastructure/security/HmacTokenHasher.js';
import { ScryptAdminCredentials } from '../../../src/infrastructure/security/ScryptAdminCredentials.js';
import { SystemClock } from '../../../src/infrastructure/time/SystemClock.js';

/** Credenciales del panel en el servidor de test; el hash se pasa a `startTestServer`. */
export const TEST_ADMIN = { username: 'admin', password: 'contraseña-de-test' } as const;

export interface TestServerOptions {
  /** Resultado de `hashAdminPassword(TEST_ADMIN.password)`, calculado una vez por suite. */
  readonly adminPasswordHash?: string;
}

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
export async function startTestServer(options: TestServerOptions = {}): Promise<TestServer> {
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
  const startQuickRound = new StartQuickRound(games, events, clock, ids);
  const castVote = new CastVote(games, events, clock);
  const revealRound = new RevealRound(games, events, clock);
  const timeoutReveal = new TimeoutReveal(games, events, clock);
  const setFinalEstimate = new SetFinalEstimate(games, events, clock);
  const updateGameSettings = new UpdateGameSettings(games, events, clock);
  const changeGameDeck = new ChangeGameDeck(games, decks, events, clock);
  const listGameDecks = new ListGameDecks(games, decks);
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
    changeGameDeck,
    listGameDecks,
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
  if (options.adminPasswordHash !== undefined) {
    const adminSessions = new HmacAdminSessions('test-session-secret', 60 * 60 * 1000);
    await registerAdminRoutes(app, {
      logInAdmin: new LogInAdmin(
        new ScryptAdminCredentials(TEST_ADMIN.username, options.adminPasswordHash),
        adminSessions,
        clock,
      ),
      sessions: adminSessions,
      throttle: new LoginThrottle(5, 15 * 60 * 1000),
      clock,
      listGamesForAdmin: new ListGamesForAdmin(games, teams),
      deleteGame: new DeleteGame(games, broadcaster),
      listTeamsForAdmin: new ListTeamsForAdmin(teams, decks, games),
      renameTeam: new RenameTeam(teams),
      regenerateTeamToken: new RegenerateTeamToken(teams, tokenHasher, ids),
      deleteTeam: new DeleteTeam(teams, decks),
      listDecksForAdmin: new ListDecksForAdmin(decks, teams),
      deleteDeckAsAdmin: new DeleteDeckAsAdmin(decks),
    });
  }
  registerSocketGateway(io, {
    getGameState,
    castVote,
    startVotingRound,
    startQuickRound,
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
