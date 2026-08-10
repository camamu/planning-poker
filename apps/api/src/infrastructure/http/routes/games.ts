import {
  addIssueCommandSchema,
  createGameCommandSchema,
  joinGameCommandSchema,
} from '@pp/contracts';
import type { FastifyInstance } from 'fastify';
import type { AddIssue } from '../../../application/use-cases/AddIssue.js';
import type { CreateGame } from '../../../application/use-cases/CreateGame.js';
import type { GetGameState } from '../../../application/use-cases/GetGameState.js';
import type { JoinGame } from '../../../application/use-cases/JoinGame.js';
import { GameId } from '../../../domain/game/ids.js';
import type { GameVersionTracker } from '../../realtime/GameVersionTracker.js';
import { sendError } from '../errors.js';

export interface GameRoutesDependencies {
  readonly createGame: CreateGame;
  readonly joinGame: JoinGame;
  readonly addIssue: AddIssue;
  readonly getGameState: GetGameState;
  readonly versions: GameVersionTracker;
}

interface GameIdParams {
  readonly id: string;
}

interface ViewerQuery {
  readonly participantId?: string;
}

export function registerGameRoutes(app: FastifyInstance, deps: GameRoutesDependencies): void {
  app.post('/api/games', async (request, reply) => {
    try {
      const command = createGameCommandSchema.parse(request.body);
      const result = await deps.createGame.execute({
        name: command.name,
        deckPreset: command.deckPreset,
        facilitatorName: command.facilitatorName,
        settings: {
          autoReveal: command.settings.autoReveal,
          whoCanReveal: command.settings.whoCanReveal,
          ...(command.settings.namedRevealers
            ? { namedRevealers: command.settings.namedRevealers }
            : {}),
        },
      });
      await reply.code(201).send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get<{ Params: GameIdParams; Querystring: ViewerQuery }>(
    '/api/games/:id',
    async (request, reply) => {
      try {
        const viewerId = request.query.participantId;
        if (!viewerId) {
          reply.code(400).send({ error: 'ValidationError', message: 'Falta participantId.' });
          return;
        }
        const state = await deps.getGameState.execute({
          gameId: request.params.id,
          viewerId,
        });
        const version = deps.versions.current(GameId.of(request.params.id));
        await reply.send({ version, state });
      } catch (error) {
        sendError(reply, error);
      }
    },
  );

  app.post<{ Params: GameIdParams }>('/api/games/:id/participants', async (request, reply) => {
    try {
      const command = joinGameCommandSchema.parse(request.body);
      const participantId = await deps.joinGame.execute({
        gameId: request.params.id,
        displayName: command.displayName,
        role: command.role,
      });
      await reply.code(201).send({ participantId });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: GameIdParams }>('/api/games/:id/issues', async (request, reply) => {
    try {
      const command = addIssueCommandSchema.parse(request.body);
      const issueId = await deps.addIssue.execute({
        gameId: request.params.id,
        title: command.title,
      });
      await reply.code(201).send({ issueId });
    } catch (error) {
      sendError(reply, error);
    }
  });
}
