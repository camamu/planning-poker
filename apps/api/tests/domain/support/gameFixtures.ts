import { Deck } from '../../../src/domain/deck/Deck.js';
import { DisplayName } from '../../../src/domain/game/DisplayName.js';
import { Game } from '../../../src/domain/game/Game.js';
import { GameName } from '../../../src/domain/game/GameName.js';
import { GameSettings } from '../../../src/domain/game/GameSettings.js';
import type { WhoCanReveal } from '../../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../../src/domain/game/ids.js';

export const NOW = new Date('2026-08-07T10:00:00Z');

let idSeq = 0;
export function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq.toString()}`;
}

export interface GameSetup {
  game: Game;
  facilitatorId: ParticipantId;
}

export function createGame(
  overrides: {
    autoReveal?: boolean;
    whoCanReveal?: WhoCanReveal;
    namedRevealers?: ParticipantId[];
    deck?: Deck;
    allowVoteChange?: boolean;
    celebrate?: boolean;
    throwEmojis?: boolean;
    countdownSeconds?: number | null;
    revealOnTimeout?: boolean;
  } = {},
): GameSetup {
  const facilitatorId = ParticipantId.of(nextId('participant'));
  const game = Game.create(
    {
      id: GameId.of(nextId('game')),
      name: GameName.of('Sprint 42'),
      deck: overrides.deck ?? Deck.fibonacci(),
      settings: GameSettings.of({
        autoReveal: overrides.autoReveal ?? false,
        whoCanReveal: overrides.whoCanReveal ?? 'FACILITATOR_ONLY',
        ...(overrides.namedRevealers ? { namedRevealers: overrides.namedRevealers } : {}),
        ...(overrides.allowVoteChange !== undefined
          ? { allowVoteChange: overrides.allowVoteChange }
          : {}),
        ...(overrides.celebrate !== undefined ? { celebrate: overrides.celebrate } : {}),
        ...(overrides.throwEmojis !== undefined ? { throwEmojis: overrides.throwEmojis } : {}),
        ...(overrides.countdownSeconds !== undefined
          ? { countdownSeconds: overrides.countdownSeconds }
          : {}),
        ...(overrides.revealOnTimeout !== undefined
          ? { revealOnTimeout: overrides.revealOnTimeout }
          : {}),
      }),
      facilitatorId,
      facilitatorName: DisplayName.of('Facilitador'),
    },
    NOW,
  );
  return { game, facilitatorId };
}

export function addVoter(game: Game, displayName = 'Jugador'): ParticipantId {
  const id = ParticipantId.of(nextId('participant'));
  game.addParticipant(id, DisplayName.of(displayName), 'VOTER', NOW);
  return id;
}

export function addIssueAndOpenRound(game: Game): { issueId: IssueId; roundId: RoundId } {
  const issueId = IssueId.of(nextId('issue'));
  game.addIssue(issueId, 'Implementar login', NOW);
  const roundId = RoundId.of(nextId('round'));
  game.startVotingRound(roundId, issueId, NOW);
  return { issueId, roundId };
}
