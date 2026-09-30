import type { AdminDeckView } from '@pp/contracts';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { teamRefResolver } from '../read-models/teamRefResolver.js';
import { toDeckSummaryView } from '../read-models/toDeckSummaryView.js';

/** Solo personalizadas: las de sistema no se pueden gestionar desde el panel. */
export class ListDecksForAdmin {
  constructor(
    private readonly decks: DeckRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(): Promise<ReadonlyArray<AdminDeckView>> {
    const [decks, teams] = await Promise.all([this.decks.listCustom(), this.teams.listAll()]);
    const teamRef = teamRefResolver(teams);
    return decks.map((deck) => {
      const { id, name, cards, teamId } = toDeckSummaryView(deck);
      return { id, name, cards, team: teamRef(teamId) };
    });
  }
}
