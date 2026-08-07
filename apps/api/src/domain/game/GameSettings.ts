import type { ParticipantId } from './ids.js';

export type WhoCanReveal = 'FACILITATOR_ONLY' | 'ANYONE' | 'NAMED_LIST';

export interface GameSettingsProps {
  readonly autoReveal: boolean;
  readonly whoCanReveal: WhoCanReveal;
  readonly namedRevealers?: ReadonlyArray<ParticipantId>;
}

export class GameSettings {
  private constructor(
    readonly autoReveal: boolean,
    readonly whoCanReveal: WhoCanReveal,
    readonly namedRevealers: ReadonlyArray<ParticipantId>,
  ) {}

  static of(props: GameSettingsProps): GameSettings {
    return new GameSettings(props.autoReveal, props.whoCanReveal, props.namedRevealers ?? []);
  }
}
