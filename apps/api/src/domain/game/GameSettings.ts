import type { ParticipantId } from './ids.js';

export type WhoCanReveal = 'FACILITATOR_ONLY' | 'ANYONE' | 'NAMED_LIST' | 'DEALER';

export interface GameSettingsProps {
  readonly autoReveal: boolean;
  readonly whoCanReveal: WhoCanReveal;
  readonly namedRevealers?: ReadonlyArray<ParticipantId>;
  readonly allowVoteChange?: boolean;
  readonly celebrate?: boolean;
  readonly throwEmojis?: boolean;
  readonly countdownSeconds?: number | null;
  readonly revealOnTimeout?: boolean;
}

export class GameSettings {
  private constructor(
    readonly autoReveal: boolean,
    readonly whoCanReveal: WhoCanReveal,
    readonly namedRevealers: ReadonlyArray<ParticipantId>,
    readonly allowVoteChange: boolean,
    readonly celebrate: boolean,
    readonly throwEmojis: boolean,
    readonly countdownSeconds: number | null,
    readonly revealOnTimeout: boolean,
  ) {}

  static of(props: GameSettingsProps): GameSettings {
    return new GameSettings(
      props.autoReveal,
      props.whoCanReveal,
      props.namedRevealers ?? [],
      props.allowVoteChange ?? true,
      props.celebrate ?? true,
      props.throwEmojis ?? false,
      props.countdownSeconds ?? null,
      props.revealOnTimeout ?? false,
    );
  }
}
