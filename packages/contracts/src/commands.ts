import { z } from 'zod';

const whoCanRevealSchema = z.enum(['FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST', 'DEALER']);
const participantRoleSchema = z.enum(['VOTER', 'SPECTATOR']);

/**
 * Compartido entre `createGameCommandSchema` y `updateGameSettingsCommandSchema`. Los defaults
 * reproducen los de la pantalla "Ajustes finos" del handoff (docs/06-handoff-diseno.md §9):
 * auto-revelar, cambiar el voto y fiesta empiezan activados; emojis lanzados y cuenta atrás no.
 */
export const gameSettingsSchema = z.object({
  autoReveal: z.boolean(),
  whoCanReveal: whoCanRevealSchema,
  namedRevealers: z.array(z.string().trim().min(1)).optional(),
  allowVoteChange: z.boolean().default(true),
  celebrate: z.boolean().default(true),
  throwEmojis: z.boolean().default(false),
  countdownSeconds: z.number().int().positive().nullable().default(null),
  revealOnTimeout: z.boolean().default(false),
});
export type GameSettingsCommandInput = z.infer<typeof gameSettingsSchema>;

/** REST — `POST /api/games` */
export const createGameCommandSchema = z.object({
  name: z.string().trim().min(1),
  deckId: z.string().trim().min(1),
  facilitatorName: z.string().trim().min(1),
  settings: gameSettingsSchema,
});
export type CreateGameCommandInput = z.infer<typeof createGameCommandSchema>;

/** REST — `POST /api/teams` */
export const createTeamCommandSchema = z.object({
  name: z.string().trim().min(1),
});
export type CreateTeamCommandInput = z.infer<typeof createTeamCommandSchema>;

/** REST — `POST /api/teams/:slug/decks` y `PATCH /api/teams/:slug/decks/:deckId` */
export const saveCustomDeckCommandSchema = z.object({
  name: z.string().trim().min(1),
  cards: z.array(z.string().trim().min(1)).min(1),
});
export type SaveCustomDeckCommandInput = z.infer<typeof saveCustomDeckCommandSchema>;

/** REST — `PATCH /api/games/:id/settings` */
export const updateGameSettingsCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  settings: gameSettingsSchema,
});
export type UpdateGameSettingsCommandInput = z.infer<typeof updateGameSettingsCommandSchema>;

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

/** WS cliente→servidor — `reveal` y `timeout_reveal` (mismo payload, ver Game.revealOnTimeout) */
export const wsRevealCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});
export type WsRevealCommandInput = z.infer<typeof wsRevealCommandSchema>;

/**
 * WS cliente→servidor — `emoji_thrown`. No pasa por ningún caso de uso (docs/adr/
 * 0005-extension-de-alcance-bloque-6.md): la gateway solo comprueba `settings.throwEmojis` y
 * reenvía. `toParticipantId: null` = modo "Reaccionar" (el emoji sale sobre el propio asiento).
 */
export const wsEmojiThrownCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
  toParticipantId: z.string().trim().min(1).nullable(),
  emoji: z.string().trim().min(1),
});
export type WsEmojiThrownCommandInput = z.infer<typeof wsEmojiThrownCommandSchema>;

/** WS cliente→servidor — `discussion_timer_control` (F8, temporizador de discusión efímero) */
const discussionTimerActionSchema = z.enum(['start', 'pause', 'resume', 'reset', 'addSeconds']);
export const wsDiscussionTimerControlCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
  roundId: z.string().trim().min(1),
  action: discussionTimerActionSchema,
  seconds: z.number().int().positive().optional(),
});
export type WsDiscussionTimerControlCommandInput = z.infer<
  typeof wsDiscussionTimerControlCommandSchema
>;
