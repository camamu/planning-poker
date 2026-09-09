import { z } from 'zod';

const createGameResponseSchema = z.object({
  gameId: z.string(),
  facilitatorId: z.string(),
});

const joinGameResponseSchema = z.object({
  participantId: z.string(),
});

const addIssueResponseSchema = z.object({
  issueId: z.string(),
});

const gameStateResponseSchema = z.object({
  version: z.number(),
  state: z.object({
    currentRound: z
      .object({
        status: z.enum(['OPEN', 'REVEALED', 'CLOSED']),
        votes: z.array(z.object({ participantId: z.string(), card: z.string().nullable() })),
      })
      .nullable(),
  }),
});

async function postJson(baseUrl: string, path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function createGameOverHttp(
  baseUrl: string,
  body: unknown,
): Promise<z.infer<typeof createGameResponseSchema>> {
  return createGameResponseSchema.parse(await postJson(baseUrl, '/api/games', body));
}

export async function joinGameOverHttp(
  baseUrl: string,
  gameId: string,
  body: unknown,
): Promise<z.infer<typeof joinGameResponseSchema>> {
  return joinGameResponseSchema.parse(
    await postJson(baseUrl, `/api/games/${gameId}/participants`, body),
  );
}

export async function addIssueOverHttp(
  baseUrl: string,
  gameId: string,
  body: unknown,
): Promise<z.infer<typeof addIssueResponseSchema>> {
  return addIssueResponseSchema.parse(await postJson(baseUrl, `/api/games/${gameId}/issues`, body));
}

export async function getGameStateOverHttp(
  baseUrl: string,
  gameId: string,
  viewerId: string,
): Promise<z.infer<typeof gameStateResponseSchema>> {
  const response = await fetch(`${baseUrl}/api/games/${gameId}?participantId=${viewerId}`);
  return gameStateResponseSchema.parse(await response.json());
}
