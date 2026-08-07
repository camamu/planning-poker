import { AddIssue } from '../../../src/application/use-cases/AddIssue.js';
import { CreateGame } from '../../../src/application/use-cases/CreateGame.js';
import type {
  CreateGameResult,
  DeckPreset,
} from '../../../src/application/use-cases/CreateGame.js';
import { StartVotingRound } from '../../../src/application/use-cases/StartVotingRound.js';
import type { WhoCanReveal } from '../../../src/domain/game/GameSettings.js';
import { makeContext } from './context.js';
import type { UseCaseContext } from './context.js';

export interface SeedGameOverrides {
  readonly deckPreset?: DeckPreset;
  readonly autoReveal?: boolean;
  readonly whoCanReveal?: WhoCanReveal;
}

export interface SeededGame extends CreateGameResult {
  readonly context: UseCaseContext;
}

export interface SeededOpenRound extends SeededGame {
  readonly issueId: string;
  readonly roundId: string;
}

export async function seedGame(overrides: SeedGameOverrides = {}): Promise<SeededGame> {
  const context = makeContext();
  const createGame = new CreateGame(context.games, context.events, context.clock, context.ids);
  const result = await createGame.execute({
    name: 'Sprint 42',
    deckPreset: overrides.deckPreset ?? 'fibonacci',
    settings: {
      autoReveal: overrides.autoReveal ?? false,
      whoCanReveal: overrides.whoCanReveal ?? 'FACILITATOR_ONLY',
    },
    facilitatorName: 'Facilitador',
  });
  context.events.clear();
  return { ...result, context };
}

export async function seedGameWithOpenRound(
  overrides: SeedGameOverrides = {},
): Promise<SeededOpenRound> {
  const seeded = await seedGame(overrides);
  const { context, gameId } = seeded;

  const addIssue = new AddIssue(context.games, context.events, context.clock, context.ids);
  const issueId = await addIssue.execute({ gameId, title: 'Implementar login' });

  const startVotingRound = new StartVotingRound(
    context.games,
    context.events,
    context.clock,
    context.ids,
  );
  const roundId = await startVotingRound.execute({ gameId, issueId });

  context.events.clear();
  return { ...seeded, issueId, roundId };
}
