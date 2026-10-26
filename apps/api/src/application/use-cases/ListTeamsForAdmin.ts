import type { AdminTeamView } from '@pp/contracts';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';

function countBy<T>(items: ReadonlyArray<T>, key: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export class ListTeamsForAdmin {
  constructor(
    private readonly teams: TeamRepository,
    private readonly decks: DeckRepository,
    private readonly games: GameRepository,
  ) {}

  async execute(): Promise<ReadonlyArray<AdminTeamView>> {
    const [teams, decks, games] = await Promise.all([
      this.teams.listAll(),
      this.decks.listCustom(),
      this.games.listSummaries(),
    ]);
    const deckCounts = countBy(decks, (deck) => deck.teamId?.value ?? null);
    const gameCounts = countBy(games, (game) => game.teamId);
    return teams.map((team) => ({
      id: team.id.value,
      slug: team.slug.value,
      name: team.name.value,
      deckCount: deckCounts.get(team.id.value) ?? 0,
      gameCount: gameCounts.get(team.id.value) ?? 0,
    }));
  }
}
