import {
  addIssueCommandSchema,
  changeGameDeckCommandSchema,
  changeParticipantHatCommandSchema,
  claimFacilitatorCommandSchema,
  createGameCommandSchema,
  editIssueCommandSchema,
  importIssuesCommandSchema,
  joinGameCommandSchema,
  removeIssueCommandSchema,
  removeParticipantCommandSchema,
  reorderIssuesCommandSchema,
  sendSessionSummaryCommandSchema,
  transferFacilitatorCommandSchema,
  updateGameSettingsCommandSchema,
} from '@pp/contracts';
import type { AddIssueCommandInput } from '@pp/contracts';
import type { FastifyInstance } from 'fastify';
import type { AddIssue } from '../../../application/use-cases/AddIssue.js';
import type { ChangeGameDeck } from '../../../application/use-cases/ChangeGameDeck.js';
import type { ChangeParticipantHat } from '../../../application/use-cases/ChangeParticipantHat.js';
import type { ClaimFacilitator } from '../../../application/use-cases/ClaimFacilitator.js';
import type { CreateGame } from '../../../application/use-cases/CreateGame.js';
import type { EditIssue } from '../../../application/use-cases/EditIssue.js';
import type { GetGameState } from '../../../application/use-cases/GetGameState.js';
import type { GetGameSummary } from '../../../application/use-cases/GetGameSummary.js';
import type { ImportIssues } from '../../../application/use-cases/ImportIssues.js';
import type { JoinGame } from '../../../application/use-cases/JoinGame.js';
import type { ListGameDecks } from '../../../application/use-cases/ListGameDecks.js';
import type { RemoveIssue } from '../../../application/use-cases/RemoveIssue.js';
import type { RemoveParticipant } from '../../../application/use-cases/RemoveParticipant.js';
import type { ReorderIssues } from '../../../application/use-cases/ReorderIssues.js';
import type { SendSessionSummary } from '../../../application/use-cases/SendSessionSummary.js';
import type { TransferFacilitator } from '../../../application/use-cases/TransferFacilitator.js';
import type { UpdateGameSettings } from '../../../application/use-cases/UpdateGameSettings.js';
import { GameId } from '../../../domain/game/ids.js';
import type { GameVersionTracker } from '../../realtime/GameVersionTracker.js';
import { sendError } from '../errors.js';

export interface GameRoutesDependencies {
  readonly createGame: CreateGame;
  readonly joinGame: JoinGame;
  readonly removeParticipant: RemoveParticipant;
  readonly transferFacilitator: TransferFacilitator;
  readonly claimFacilitator: ClaimFacilitator;
  readonly addIssue: AddIssue;
  readonly importIssues: ImportIssues;
  readonly editIssue: EditIssue;
  readonly removeIssue: RemoveIssue;
  readonly reorderIssues: ReorderIssues;
  readonly getGameState: GetGameState;
  readonly getGameSummary: GetGameSummary;
  readonly sendSessionSummary: SendSessionSummary;
  readonly updateGameSettings: UpdateGameSettings;
  readonly changeGameDeck: ChangeGameDeck;
  readonly listGameDecks: ListGameDecks;
  readonly changeParticipantHat: ChangeParticipantHat;
  readonly versions: GameVersionTracker;
}

interface GameIdParams {
  readonly id: string;
}

interface ParticipantParams extends GameIdParams {
  readonly participantId: string;
}

interface IssueParams extends GameIdParams {
  readonly issueId: string;
}

interface ViewerQuery {
  readonly participantId?: string;
}

/** `exactOptionalPropertyTypes`: un `undefined` explícito no es lo mismo que la clave ausente. */
function issueDetails(entry: AddIssueCommandInput): { description?: string; externalUrl?: string } {
  return {
    ...(entry.description !== undefined ? { description: entry.description } : {}),
    ...(entry.externalUrl !== undefined ? { externalUrl: entry.externalUrl } : {}),
  };
}

export function registerGameRoutes(app: FastifyInstance, deps: GameRoutesDependencies): void {
  app.post('/api/games', async (request, reply) => {
    try {
      const command = createGameCommandSchema.parse(request.body);
      const result = await deps.createGame.execute({
        name: command.name,
        deckId: command.deckId,
        facilitatorName: command.facilitatorName,
        ...(command.teamSlug ? { teamSlug: command.teamSlug } : {}),
        settings: {
          autoReveal: command.settings.autoReveal,
          whoCanReveal: command.settings.whoCanReveal,
          ...(command.settings.namedRevealers
            ? { namedRevealers: command.settings.namedRevealers }
            : {}),
          allowVoteChange: command.settings.allowVoteChange,
          celebrate: command.settings.celebrate,
          throwEmojis: command.settings.throwEmojis,
          countdownSeconds: command.settings.countdownSeconds,
          revealOnTimeout: command.settings.revealOnTimeout,
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

  app.get<{ Params: GameIdParams }>('/api/games/:id/summary', async (request, reply) => {
    try {
      await reply.send(await deps.getGameSummary.execute({ gameId: request.params.id }));
    } catch (error) {
      sendError(reply, error);
    }
  });

  // Envía el resumen a los webhooks del equipo y espera el resultado (ADR 0028).
  app.post<{ Params: GameIdParams }>('/api/games/:id/summary/webhook', async (request, reply) => {
    try {
      const command = sendSessionSummaryCommandSchema.parse(request.body);
      await reply.send(
        await deps.sendSessionSummary.execute({
          gameId: request.params.id,
          participantId: command.participantId,
        }),
      );
    } catch (error) {
      sendError(reply, error);
    }
  });

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

  app.delete<{ Params: ParticipantParams }>(
    '/api/games/:id/participants/:participantId',
    async (request, reply) => {
      try {
        const command = removeParticipantCommandSchema.parse(request.body);
        await deps.removeParticipant.execute({
          gameId: request.params.id,
          participantId: request.params.participantId,
          requestedBy: command.participantId,
        });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    },
  );

  app.post<{ Params: GameIdParams }>('/api/games/:id/facilitator', async (request, reply) => {
    try {
      const command = transferFacilitatorCommandSchema.parse(request.body);
      await deps.transferFacilitator.execute({
        gameId: request.params.id,
        participantId: command.participantId,
        toParticipantId: command.toParticipantId,
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: GameIdParams }>('/api/games/:id/facilitator/claim', async (request, reply) => {
    try {
      const command = claimFacilitatorCommandSchema.parse(request.body);
      await deps.claimFacilitator.execute({
        gameId: request.params.id,
        participantId: command.participantId,
      });
      await reply.code(204).send();
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
        ...issueDetails(command),
      });
      await reply.code(201).send({ issueId });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: GameIdParams }>('/api/games/:id/issues/batch', async (request, reply) => {
    try {
      const command = importIssuesCommandSchema.parse(request.body);
      const issueIds = await deps.importIssues.execute({
        gameId: request.params.id,
        issues: command.issues.map((entry) => ({ title: entry.title, ...issueDetails(entry) })),
      });
      await reply.code(201).send({ issueIds });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.patch<{ Params: IssueParams }>('/api/games/:id/issues/:issueId', async (request, reply) => {
    try {
      const command = editIssueCommandSchema.parse(request.body);
      await deps.editIssue.execute({
        gameId: request.params.id,
        issueId: request.params.issueId,
        participantId: command.participantId,
        title: command.title,
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(command.externalUrl !== undefined ? { externalUrl: command.externalUrl } : {}),
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.delete<{ Params: IssueParams }>('/api/games/:id/issues/:issueId', async (request, reply) => {
    try {
      const command = removeIssueCommandSchema.parse(request.body);
      await deps.removeIssue.execute({
        gameId: request.params.id,
        issueId: request.params.issueId,
        participantId: command.participantId,
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.put<{ Params: GameIdParams }>('/api/games/:id/issues/order', async (request, reply) => {
    try {
      const command = reorderIssuesCommandSchema.parse(request.body);
      await deps.reorderIssues.execute({
        gameId: request.params.id,
        participantId: command.participantId,
        issueIds: command.issueIds,
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.patch<{ Params: GameIdParams }>('/api/games/:id/settings', async (request, reply) => {
    try {
      const command = updateGameSettingsCommandSchema.parse(request.body);
      await deps.updateGameSettings.execute({
        gameId: request.params.id,
        participantId: command.participantId,
        settings: {
          autoReveal: command.settings.autoReveal,
          whoCanReveal: command.settings.whoCanReveal,
          ...(command.settings.namedRevealers
            ? { namedRevealers: command.settings.namedRevealers }
            : {}),
          allowVoteChange: command.settings.allowVoteChange,
          celebrate: command.settings.celebrate,
          throwEmojis: command.settings.throwEmojis,
          countdownSeconds: command.settings.countdownSeconds,
          revealOnTimeout: command.settings.revealOnTimeout,
        },
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get<{ Params: GameIdParams }>('/api/games/:id/decks', async (request, reply) => {
    try {
      const decks = await deps.listGameDecks.execute({ gameId: request.params.id });
      await reply.send(decks);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.patch<{ Params: GameIdParams }>('/api/games/:id/deck', async (request, reply) => {
    try {
      const command = changeGameDeckCommandSchema.parse(request.body);
      await deps.changeGameDeck.execute({
        gameId: request.params.id,
        participantId: command.participantId,
        deckId: command.deckId,
      });
      await reply.code(204).send();
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.patch<{ Params: ParticipantParams }>(
    '/api/games/:id/participants/:participantId/hat',
    async (request, reply) => {
      try {
        const command = changeParticipantHatCommandSchema.parse(request.body);
        await deps.changeParticipantHat.execute({
          gameId: request.params.id,
          participantId: request.params.participantId,
          hat: command.hat,
          requestedBy: command.participantId,
        });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    },
  );
}
