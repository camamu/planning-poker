import { z } from 'zod';
import type { HatIdView } from './views.js';

const whoCanRevealSchema = z.enum(['FACILITATOR_ONLY', 'ANYONE', 'NAMED_LIST', 'DEALER']);
const participantRoleSchema = z.enum(['VOTER', 'SPECTATOR']);

/**
 * Compartido entre `createGameCommandSchema` y `updateGameSettingsCommandSchema`. Los defaults
 * reproducen los de la pantalla "Ajustes finos" del handoff (docs/06-handoff-diseno.md §9):
 * auto-revelar, cambiar el voto, fiesta y emojis lanzados empiezan activados; cuenta atrás no
 * (emojis activados por defecto desde ADR 0018).
 */
export const gameSettingsSchema = z.object({
  autoReveal: z.boolean(),
  whoCanReveal: whoCanRevealSchema,
  namedRevealers: z.array(z.string().trim().min(1)).optional(),
  allowVoteChange: z.boolean().default(true),
  celebrate: z.boolean().default(true),
  throwEmojis: z.boolean().default(true),
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
  /** Equipo del que sale la baraja. Sin token, igual que listar barajas — ver ADR 0006. */
  teamSlug: z.string().trim().min(1).optional(),
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

/** REST — `PATCH /api/games/:id/deck` */
export const changeGameDeckCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  deckId: z.string().trim().min(1),
});
export type ChangeGameDeckCommandInput = z.infer<typeof changeGameDeckCommandSchema>;

/** Orden de presentación del selector de sombreros en el front. */
export const HAT_IDS = [
  'cowboy',
  'wizard',
  'propeller',
  'crown',
  'top-hat',
  'party',
  'pirate',
  'viking',
  'chef',
] as const satisfies ReadonlyArray<HatIdView>;

/**
 * REST — `PATCH /api/games/:id/participants/:participantId/hat`. `participantId` del cuerpo es
 * quien lo pide; solo vale si coincide con el de la URL (`Game.changeParticipantHat`).
 */
export const changeParticipantHatCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  hat: z.enum(HAT_IDS).nullable(),
});
export type ChangeParticipantHatCommandInput = z.infer<typeof changeParticipantHatCommandSchema>;

/** REST — `POST /api/games/:id/participants` */
export const joinGameCommandSchema = z.object({
  displayName: z.string().trim().min(1),
  role: participantRoleSchema,
});
export type JoinGameCommandInput = z.infer<typeof joinGameCommandSchema>;

/**
 * REST — `DELETE /api/games/:id/participants/:participantId`. `participantId` del cuerpo es quien
 * lo pide: el propio participante (salir) o el facilitador (quitar).
 */
export const removeParticipantCommandSchema = z.object({
  participantId: z.string().trim().min(1),
});
export type RemoveParticipantCommandInput = z.infer<typeof removeParticipantCommandSchema>;

/**
 * REST — `POST /api/games/:id/facilitator`. `participantId` es quien cede el rol (solo vale si es
 * el facilitador actual) y `toParticipantId` quien lo recibe.
 */
export const transferFacilitatorCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  toParticipantId: z.string().trim().min(1),
});
export type TransferFacilitatorCommandInput = z.infer<typeof transferFacilitatorCommandSchema>;

/**
 * REST — `POST /api/games/:id/facilitator/claim`. `participantId` es quien toma el relevo; solo
 * prospera si el facilitador actual no está conectado (`Game.claimFacilitator`).
 */
export const claimFacilitatorCommandSchema = z.object({
  participantId: z.string().trim().min(1),
});
export type ClaimFacilitatorCommandInput = z.infer<typeof claimFacilitatorCommandSchema>;

/** REST — `POST /api/games/:id/issues` */
export const addIssueCommandSchema = z.object({
  title: z.string().trim().min(1),
});
export type AddIssueCommandInput = z.infer<typeof addIssueCommandSchema>;

/**
 * REST — `PATCH /api/games/:id/issues/:issueId`. `description` y `externalUrl` ausentes dejan lo
 * que había (ADR 0019). `externalUrl` solo admite http(s): se pintará como enlace (bloque 15).
 */
export const editIssueCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  externalUrl: z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https?$/ }))
    .optional(),
});
export type EditIssueCommandInput = z.infer<typeof editIssueCommandSchema>;

/** REST — `DELETE /api/games/:id/issues/:issueId` */
export const removeIssueCommandSchema = z.object({
  participantId: z.string().trim().min(1),
});
export type RemoveIssueCommandInput = z.infer<typeof removeIssueCommandSchema>;

/** REST — `PUT /api/games/:id/issues/order`. Tiene que ser una permutación de TODAS las tareas. */
export const reorderIssuesCommandSchema = z.object({
  participantId: z.string().trim().min(1),
  issueIds: z.array(z.string().trim().min(1)),
});
export type ReorderIssuesCommandInput = z.infer<typeof reorderIssuesCommandSchema>;

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

/** WS cliente→servidor — `start_quick_round` (vota ya, sin crear tarea: ver Game.startQuickRound) */
export const wsStartQuickRoundCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});
export type WsStartQuickRoundCommandInput = z.infer<typeof wsStartQuickRoundCommandSchema>;

/** WS cliente→servidor — `reveal` y `timeout_reveal` (mismo payload, ver Game.revealOnTimeout) */
export const wsRevealCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});
export type WsRevealCommandInput = z.infer<typeof wsRevealCommandSchema>;

/** WS cliente→servidor — `set_estimate` (invariante 10: cierra la issue con la carta acordada) */
export const wsSetEstimateCommandSchema = z.object({
  gameId: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
  card: z.string().trim().min(1),
});
export type WsSetEstimateCommandInput = z.infer<typeof wsSetEstimateCommandSchema>;

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

/** REST — `POST /api/admin/session` */
export const adminLoginCommandSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type AdminLoginCommandInput = z.infer<typeof adminLoginCommandSchema>;

/** REST — `PATCH /api/admin/teams/:teamId` */
export const renameTeamCommandSchema = z.object({
  name: z.string().trim().min(1),
});
export type RenameTeamCommandInput = z.infer<typeof renameTeamCommandSchema>;
