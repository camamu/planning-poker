import { z } from 'zod';

const whoCanRevealSchema = z.enum(['FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST']);
const participantRoleSchema = z.enum(['VOTER', 'SPECTATOR']);

/** REST — `POST /api/games` */
export const createGameCommandSchema = z.object({
  name: z.string().trim().min(1),
  deckPreset: z.enum(['fibonacci', 'tshirt']),
  facilitatorName: z.string().trim().min(1),
  settings: z.object({
    autoReveal: z.boolean(),
    whoCanReveal: whoCanRevealSchema,
    namedRevealers: z.array(z.string().trim().min(1)).optional(),
  }),
});
export type CreateGameCommandInput = z.infer<typeof createGameCommandSchema>;

/** REST — `POST /api/games/:id/participants` */
export const joinGameCommandSchema = z.object({
  displayName: z.string().trim().min(1),
  role: participantRoleSchema,
});
export type JoinGameCommandInput = z.infer<typeof joinGameCommandSchema>;

/** REST — `POST /api/games/:id/issues` */
export const addIssueCommandSchema = z.object({
  title: z.string().trim().min(1),
});
export type AddIssueCommandInput = z.infer<typeof addIssueCommandSchema>;

/** WS cliente→servidor — `join` (entra en la room de la partida y pide `state_sync`) */
export const wsJoinCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});
export type WsJoinCommandInput = z.infer<typeof wsJoinCommandSchema>;

/** WS cliente→servidor — `vote` */
export const wsVoteCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
  card: z.string().trim().min(1),
});
export type WsVoteCommandInput = z.infer<typeof wsVoteCommandSchema>;

/** WS cliente→servidor — `start_round` */
export const wsStartRoundCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
  issueId: z.string().trim().min(1),
});
export type WsStartRoundCommandInput = z.infer<typeof wsStartRoundCommandSchema>;

/** WS cliente→servidor — `reveal` */
export const wsRevealCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});
export type WsRevealCommandInput = z.infer<typeof wsRevealCommandSchema>;
