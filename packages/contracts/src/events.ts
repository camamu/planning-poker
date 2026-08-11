import type { GameSettingsView, GameView, ParticipantRoleView, RoundResultView } from './views.js';

/**
 * Todos los eventos servidor→cliente llevan `version`, el contador incremental de la
 * partida (docs/01-especificacion.md §6.2). El cliente que detecta un salto de versión
 * pide `state_sync` en vez de intentar reconciliar el hueco.
 */
interface ServerEventBase {
  readonly version: number;
}

export type ServerEvent =
  | (ServerEventBase & { readonly type: 'state_sync'; readonly state: GameView })
  | (ServerEventBase & { readonly type: 'participant_joined'; readonly participantId: string })
  | (ServerEventBase & {
      readonly type: 'participant_role_changed';
      readonly participantId: string;
      readonly role: ParticipantRoleView;
    })
  | (ServerEventBase & { readonly type: 'issue_added'; readonly issueId: string })
  | (ServerEventBase & {
      readonly type: 'round_started';
      readonly roundId: string;
      readonly issueId: string;
    })
  // Invariante 7: nunca lleva `card`, solo la señal de que ese participante ya votó.
  | (ServerEventBase & {
      readonly type: 'participant_voted';
      readonly roundId: string;
      readonly participantId: string;
    })
  | (ServerEventBase & {
      readonly type: 'vote_retracted';
      readonly roundId: string;
      readonly participantId: string;
    })
  // Único evento que lleva valores de voto: la ronda ya está revelada para todos.
  | (ServerEventBase & {
      readonly type: 'round_revealed';
      readonly roundId: string;
      readonly votes: ReadonlyArray<{ readonly participantId: string; readonly card: string }>;
      readonly result: RoundResultView;
    })
  | (ServerEventBase & {
      readonly type: 'issue_estimated';
      readonly issueId: string;
      readonly finalEstimate: string;
    })
  | (ServerEventBase & { readonly type: 'settings_changed'; readonly settings: GameSettingsView });

export type ServerEventType = ServerEvent['type'];

export interface ServerErrorEvent {
  readonly type: 'error';
  readonly message: string;
}

/**
 * Eventos que no son un hecho de negocio del agregado `Game`: no llevan `version`, no pasan por
 * `WsEventPublisher` ni por `state_sync`, y perderlos en una reconexión es aceptable (docs/adr/
 * 0005-extension-de-alcance-bloque-6.md). `emoji_thrown` es flair transitorio; `discussion_timer_sync`
 * es un detalle de entrega en tiempo real (F8), no un dato que sobreviva a un reinicio del servidor.
 */
export type EphemeralEvent =
  | {
      readonly type: 'emoji_thrown';
      readonly fromParticipantId: string;
      readonly toParticipantId: string | null;
      readonly emoji: string;
    }
  | {
      readonly type: 'discussion_timer_sync';
      readonly roundId: string;
      readonly running: boolean;
      readonly remainingMs: number;
    };
