import { adminLoginCommandSchema, renameTeamCommandSchema } from '@pp/contracts';
import type { FastifyInstance } from 'fastify';
import type { AdminSessions } from '../../../application/ports/AdminSessions.js';
import type { DeleteDeckAsAdmin } from '../../../application/use-cases/DeleteDeckAsAdmin.js';
import type { DeleteGame } from '../../../application/use-cases/DeleteGame.js';
import type { DeleteTeam } from '../../../application/use-cases/DeleteTeam.js';
import { InvalidAdminCredentialsError } from '../../../application/use-cases/InvalidAdminCredentialsError.js';
import type { ListDecksForAdmin } from '../../../application/use-cases/ListDecksForAdmin.js';
import type { ListGamesForAdmin } from '../../../application/use-cases/ListGamesForAdmin.js';
import type { ListTeamsForAdmin } from '../../../application/use-cases/ListTeamsForAdmin.js';
import type { LogInAdmin } from '../../../application/use-cases/LogInAdmin.js';
import type { RegenerateTeamToken } from '../../../application/use-cases/RegenerateTeamToken.js';
import type { RenameTeam } from '../../../application/use-cases/RenameTeam.js';
import type { Clock } from '../../../domain/shared/Clock.js';
import { sendError } from '../errors.js';
import type { LoginThrottle } from '../LoginThrottle.js';

export interface AdminRoutesDependencies {
  readonly logInAdmin: LogInAdmin;
  readonly sessions: AdminSessions;
  readonly throttle: LoginThrottle;
  readonly clock: Clock;
  readonly listGamesForAdmin: ListGamesForAdmin;
  readonly deleteGame: DeleteGame;
  readonly listTeamsForAdmin: ListTeamsForAdmin;
  readonly renameTeam: RenameTeam;
  readonly regenerateTeamToken: RegenerateTeamToken;
  readonly deleteTeam: DeleteTeam;
  readonly listDecksForAdmin: ListDecksForAdmin;
  readonly deleteDeckAsAdmin: DeleteDeckAsAdmin;
}

interface GameParams {
  readonly gameId: string;
}

interface TeamParams {
  readonly teamId: string;
}

interface DeckParams {
  readonly deckId: string;
}

const BEARER_PREFIX = 'Bearer ';

function bearerToken(header: string | undefined): string | null {
  return header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : null;
}

/** Sin `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` el panel no existe; un 503 explícito ahorra adivinar por qué. */
export function registerDisabledAdminRoutes(app: FastifyInstance): void {
  app.all('/api/admin/*', async (_request, reply) => {
    await reply.code(503).send({
      error: 'AdminDisabled',
      message:
        'El panel de gestión no está activado en este servidor: faltan ADMIN_USERNAME y ADMIN_PASSWORD_HASH.',
    });
  });
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: AdminRoutesDependencies,
): Promise<void> {
  app.post('/api/admin/session', async (request, reply) => {
    const now = deps.clock.now().getTime();
    if (deps.throttle.isBlocked(request.ip, now)) {
      await reply.code(429).send({
        error: 'TooManyAttempts',
        message: 'Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.',
      });
      return;
    }
    try {
      const command = adminLoginCommandSchema.parse(request.body);
      const session = await deps.logInAdmin.execute(command);
      deps.throttle.reset(request.ip);
      await reply.code(201).send(session);
    } catch (error) {
      if (error instanceof InvalidAdminCredentialsError)
        deps.throttle.recordFailure(request.ip, now);
      sendError(reply, error);
    }
  });

  // Plugin encapsulado: el hook de autenticación solo afecta a las rutas registradas dentro.
  await app.register((scope, _options, done) => {
    scope.addHook('onRequest', async (request, reply) => {
      const token = bearerToken(request.headers.authorization);
      if (token === null || !deps.sessions.isValid(token, deps.clock.now())) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'La sesión del panel no es válida o ha caducado.',
        });
      }
      return undefined;
    });

    scope.get('/api/admin/games', async (_request, reply) => {
      await reply.send(await deps.listGamesForAdmin.execute());
    });

    scope.delete<{ Params: GameParams }>('/api/admin/games/:gameId', async (request, reply) => {
      try {
        await deps.deleteGame.execute({ gameId: request.params.gameId });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    scope.get('/api/admin/teams', async (_request, reply) => {
      await reply.send(await deps.listTeamsForAdmin.execute());
    });

    scope.patch<{ Params: TeamParams }>('/api/admin/teams/:teamId', async (request, reply) => {
      try {
        const command = renameTeamCommandSchema.parse(request.body);
        await deps.renameTeam.execute({ teamId: request.params.teamId, name: command.name });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    scope.post<{ Params: TeamParams }>('/api/admin/teams/:teamId/token', async (request, reply) => {
      try {
        const result = await deps.regenerateTeamToken.execute({ teamId: request.params.teamId });
        await reply.code(201).send(result);
      } catch (error) {
        sendError(reply, error);
      }
    });

    scope.delete<{ Params: TeamParams }>('/api/admin/teams/:teamId', async (request, reply) => {
      try {
        await deps.deleteTeam.execute({ teamId: request.params.teamId });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    scope.get('/api/admin/decks', async (_request, reply) => {
      await reply.send(await deps.listDecksForAdmin.execute());
    });

    scope.delete<{ Params: DeckParams }>('/api/admin/decks/:deckId', async (request, reply) => {
      try {
        await deps.deleteDeckAsAdmin.execute({ deckId: request.params.deckId });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    done();
  });
}
