import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { Server as SocketIoServer } from 'socket.io';
import { AddIssue } from './application/use-cases/AddIssue.js';
import { AuthenticateTeam } from './application/use-cases/AuthenticateTeam.js';
import { CastVote } from './application/use-cases/CastVote.js';
import { CreateGame } from './application/use-cases/CreateGame.js';
import { CreateTeam } from './application/use-cases/CreateTeam.js';
import { DeleteCustomDeck } from './application/use-cases/DeleteCustomDeck.js';
import { DeleteDeckAsAdmin } from './application/use-cases/DeleteDeckAsAdmin.js';
import { DeleteGame } from './application/use-cases/DeleteGame.js';
import { DeleteTeam } from './application/use-cases/DeleteTeam.js';
import { EditIssue } from './application/use-cases/EditIssue.js';
import { GetGameState } from './application/use-cases/GetGameState.js';
import { ImportIssues } from './application/use-cases/ImportIssues.js';
import { JoinGame } from './application/use-cases/JoinGame.js';
import { ListDecks } from './application/use-cases/ListDecks.js';
import { ListDecksForAdmin } from './application/use-cases/ListDecksForAdmin.js';
import { ListGamesForAdmin } from './application/use-cases/ListGamesForAdmin.js';
import { ListTeamsForAdmin } from './application/use-cases/ListTeamsForAdmin.js';
import { LogInAdmin } from './application/use-cases/LogInAdmin.js';
import { RegenerateTeamToken } from './application/use-cases/RegenerateTeamToken.js';
import { RenameTeam } from './application/use-cases/RenameTeam.js';
import { ReconcileAutoReveal } from './application/use-cases/ReconcileAutoReveal.js';
import { RemoveIssue } from './application/use-cases/RemoveIssue.js';
import { RemoveParticipant } from './application/use-cases/RemoveParticipant.js';
import { ReorderIssues } from './application/use-cases/ReorderIssues.js';
import { TransferFacilitator } from './application/use-cases/TransferFacilitator.js';
import { RevealRound } from './application/use-cases/RevealRound.js';
import { SaveCustomDeck } from './application/use-cases/SaveCustomDeck.js';
import { StartQuickRound } from './application/use-cases/StartQuickRound.js';
import { StartVotingRound } from './application/use-cases/StartVotingRound.js';
import { SetFinalEstimate } from './application/use-cases/SetFinalEstimate.js';
import { TimeoutReveal } from './application/use-cases/TimeoutReveal.js';
import { UpdateCustomDeck } from './application/use-cases/UpdateCustomDeck.js';
import { ChangeGameDeck } from './application/use-cases/ChangeGameDeck.js';
import { ChangeParticipantHat } from './application/use-cases/ChangeParticipantHat.js';
import { ClaimFacilitator } from './application/use-cases/ClaimFacilitator.js';
import { ListGameDecks } from './application/use-cases/ListGameDecks.js';
import { UpdateGameSettings } from './application/use-cases/UpdateGameSettings.js';
import { loadEnv } from './infrastructure/config/env.js';
import { LoginThrottle } from './infrastructure/http/LoginThrottle.js';
import {
  registerAdminRoutes,
  registerDisabledAdminRoutes,
} from './infrastructure/http/routes/admin.js';
import { registerGameRoutes } from './infrastructure/http/routes/games.js';
import { registerHealthRoutes } from './infrastructure/http/routes/health.js';
import { registerTeamRoutes } from './infrastructure/http/routes/teams.js';
import { UuidGenerator } from './infrastructure/ids/UuidGenerator.js';
import { createDb } from './infrastructure/persistence/postgres/db.js';
import { PostgresDeckRepository } from './infrastructure/persistence/postgres/PostgresDeckRepository.js';
import { PostgresGameRepository } from './infrastructure/persistence/postgres/PostgresGameRepository.js';
import { PostgresTeamRepository } from './infrastructure/persistence/postgres/PostgresTeamRepository.js';
import { DiscussionTimerTracker } from './infrastructure/realtime/DiscussionTimerTracker.js';
import { GameVersionTracker } from './infrastructure/realtime/GameVersionTracker.js';
import { registerSocketGateway } from './infrastructure/realtime/SocketIoGateway.js';
import { SocketIoBroadcaster } from './infrastructure/realtime/SocketIoBroadcaster.js';
import { PresenceTracker } from './infrastructure/realtime/PresenceTracker.js';
import { createPresenceListener } from './infrastructure/realtime/presenceListener.js';
import { WsEventPublisher } from './infrastructure/realtime/WsEventPublisher.js';
import { HmacAdminSessions } from './infrastructure/security/HmacAdminSessions.js';
import { HmacTokenHasher } from './infrastructure/security/HmacTokenHasher.js';
import { ScryptAdminCredentials } from './infrastructure/security/ScryptAdminCredentials.js';
import { SystemClock } from './infrastructure/time/SystemClock.js';

const env = loadEnv();
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const app = Fastify({ logger: { level: env.LOG_LEVEL } });
const pool = new Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (error) => {
  app.log.error(error, 'error inesperado en un cliente idle del pool de postgres');
});

const db = createDb(pool);
const games = new PostgresGameRepository(db);
const teams = new PostgresTeamRepository(db);
const decks = new PostgresDeckRepository(db);
const clock = new SystemClock();
const ids = new UuidGenerator();
const tokenHasher = new HmacTokenHasher(env.SESSION_SECRET);
const versions = new GameVersionTracker();
const discussionTimer = new DiscussionTimerTracker();
// 30 s de gracia: un corte breve de red o una pestaña dormida en el móvil no deben contar como salir.
const presence = new PresenceTracker(clock, { graceMs: 30_000, warmupMs: 30_000 });

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
});
registerHealthRoutes(app, pool, env.APP_VERSION);

const io = new SocketIoServer(app.server, { cors: { origin: env.CORS_ORIGIN } });
const broadcaster = new SocketIoBroadcaster(io);
const events = new WsEventPublisher(games, broadcaster, versions);

const reconcileAutoReveal = new ReconcileAutoReveal(games, events, clock, presence);
presence.onChange(
  createPresenceListener(io, reconcileAutoReveal, (error) => {
    app.log.error(error, 'no se pudo reconciliar el auto-revelado tras un cambio de presencia');
  }),
);

const createGame = new CreateGame(games, decks, teams, events, clock, ids);
const joinGame = new JoinGame(games, events, clock, ids);
const addIssue = new AddIssue(games, events, clock, ids);
const importIssues = new ImportIssues(games, events, clock, ids);
const editIssue = new EditIssue(games, events, clock);
const removeIssue = new RemoveIssue(games, events, clock);
const reorderIssues = new ReorderIssues(games, events, clock);
const startVotingRound = new StartVotingRound(games, events, clock, ids);
const startQuickRound = new StartQuickRound(games, events, clock, ids);
const castVote = new CastVote(games, events, clock, presence);
const removeParticipant = new RemoveParticipant(games, events, clock, presence);
const transferFacilitator = new TransferFacilitator(games, events, clock);
const claimFacilitator = new ClaimFacilitator(games, events, clock, presence);
const revealRound = new RevealRound(games, events, clock);
const timeoutReveal = new TimeoutReveal(games, events, clock);
const setFinalEstimate = new SetFinalEstimate(games, events, clock);
const updateGameSettings = new UpdateGameSettings(games, events, clock);
const changeGameDeck = new ChangeGameDeck(games, decks, events, clock);
const changeParticipantHat = new ChangeParticipantHat(games, events, clock);
const listGameDecks = new ListGameDecks(games, decks);
const getGameState = new GetGameState(games, presence);

const createTeam = new CreateTeam(teams, tokenHasher, ids);
const authenticateTeam = new AuthenticateTeam(teams, tokenHasher);
const listDecks = new ListDecks(decks, teams);
const saveCustomDeck = new SaveCustomDeck(decks, teams, tokenHasher, ids);
const updateCustomDeck = new UpdateCustomDeck(decks, teams, tokenHasher);
const deleteCustomDeck = new DeleteCustomDeck(decks, teams, tokenHasher);

registerGameRoutes(app, {
  createGame,
  joinGame,
  removeParticipant,
  transferFacilitator,
  claimFacilitator,
  addIssue,
  importIssues,
  editIssue,
  removeIssue,
  reorderIssues,
  getGameState,
  updateGameSettings,
  changeGameDeck,
  changeParticipantHat,
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
if (env.ADMIN_USERNAME !== undefined && env.ADMIN_PASSWORD_HASH !== undefined) {
  // Con el hash de la contraseña en la clave, cambiarla cierra todas las sesiones abiertas.
  const adminSessions = new HmacAdminSessions(
    `${env.SESSION_SECRET}:${env.ADMIN_PASSWORD_HASH}`,
    ADMIN_SESSION_TTL_MS,
  );
  await registerAdminRoutes(app, {
    logInAdmin: new LogInAdmin(
      new ScryptAdminCredentials(env.ADMIN_USERNAME, env.ADMIN_PASSWORD_HASH),
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
} else {
  registerDisabledAdminRoutes(app);
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
  presence,
  clock,
});

app.addHook('onClose', async () => {
  await io.close();
  await db.destroy();
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });
