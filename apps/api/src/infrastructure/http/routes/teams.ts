import { createTeamCommandSchema, saveCustomDeckCommandSchema } from '@pp/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticateTeam } from '../../../application/use-cases/AuthenticateTeam.js';
import type { CreateTeam } from '../../../application/use-cases/CreateTeam.js';
import type { DeleteCustomDeck } from '../../../application/use-cases/DeleteCustomDeck.js';
import type { ListDecks } from '../../../application/use-cases/ListDecks.js';
import type { SaveCustomDeck } from '../../../application/use-cases/SaveCustomDeck.js';
import type { UpdateCustomDeck } from '../../../application/use-cases/UpdateCustomDeck.js';
import { sendError } from '../errors.js';

export interface TeamRoutesDependencies {
  readonly createTeam: CreateTeam;
  readonly authenticateTeam: AuthenticateTeam;
  readonly listDecks: ListDecks;
  readonly saveCustomDeck: SaveCustomDeck;
  readonly updateCustomDeck: UpdateCustomDeck;
  readonly deleteCustomDeck: DeleteCustomDeck;
}

interface TeamSlugParams {
  readonly slug: string;
}

interface DeckParams extends TeamSlugParams {
  readonly deckId: string;
}

interface TokenQuery {
  readonly k?: string;
}

interface DecksQuery {
  readonly teamSlug?: string;
}

/** `undefined` significa que ya se ha respondido 400 y el handler debe volver sin hacer nada más. */
function requireToken(query: TokenQuery, reply: FastifyReply): string | undefined {
  if (!query.k) {
    reply.code(400).send({ error: 'ValidationError', message: 'Falta el parámetro k (token).' });
    return undefined;
  }
  return query.k;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamRoutesDependencies): void {
  app.post('/api/teams', async (request, reply) => {
    try {
      const command = createTeamCommandSchema.parse(request.body);
      const result = await deps.createTeam.execute(command);
      await reply.code(201).send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get<{ Params: TeamSlugParams; Querystring: TokenQuery }>(
    '/api/teams/:slug',
    async (request, reply) => {
      try {
        const token = requireToken(request.query, reply);
        if (token === undefined) return;
        const result = await deps.authenticateTeam.execute({ slug: request.params.slug, token });
        await reply.send(result);
      } catch (error) {
        sendError(reply, error);
      }
    },
  );

  app.get<{ Querystring: DecksQuery }>('/api/decks', async (request, reply) => {
    try {
      const { teamSlug } = request.query;
      const decks = await deps.listDecks.execute(teamSlug ? { teamSlug } : {});
      await reply.send(decks);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: TeamSlugParams; Querystring: TokenQuery }>(
    '/api/teams/:slug/decks',
    async (request, reply) => {
      try {
        const token = requireToken(request.query, reply);
        if (token === undefined) return;
        const command = saveCustomDeckCommandSchema.parse(request.body);
        const result = await deps.saveCustomDeck.execute({
          teamSlug: request.params.slug,
          token,
          name: command.name,
          cards: command.cards,
        });
        await reply.code(201).send(result);
      } catch (error) {
        sendError(reply, error);
      }
    },
  );

  app.patch<{ Params: DeckParams; Querystring: TokenQuery }>(
    '/api/teams/:slug/decks/:deckId',
    async (request, reply) => {
      try {
        const token = requireToken(request.query, reply);
        if (token === undefined) return;
        const command = saveCustomDeckCommandSchema.parse(request.body);
        await deps.updateCustomDeck.execute({
          teamSlug: request.params.slug,
          token,
          deckId: request.params.deckId,
          name: command.name,
          cards: command.cards,
        });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    },
  );

  app.delete<{ Params: DeckParams; Querystring: TokenQuery }>(
    '/api/teams/:slug/decks/:deckId',
    async (request, reply) => {
      try {
        const token = requireToken(request.query, reply);
        if (token === undefined) return;
        await deps.deleteCustomDeck.execute({
          teamSlug: request.params.slug,
          token,
          deckId: request.params.deckId,
        });
        await reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    },
  );
}
