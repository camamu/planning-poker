import type { DeckSummaryView } from '@pp/contracts';
import { TeamSlug } from '../../domain/team/TeamSlug.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { toDeckSummaryView } from '../read-models/toDeckSummaryView.js';
import { TeamNotFoundError } from './TeamNotFoundError.js';

export interface ListDecksQuery {
  /** Sin `teamSlug`: solo las barajas de sistema. La lectura no exige token — ver ADR 0006. */
  readonly teamSlug?: string;
}

export class ListDecks {
  constructor(
    private readonly decks: DeckRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(query: ListDecksQuery): Promise<ReadonlyArray<DeckSummaryView>> {
    if (!query.teamSlug) {
      const decks = await this.decks.listAvailableFor(null);
      return decks.map(toDeckSummaryView);
    }

    const team = await this.teams.findBySlug(TeamSlug.of(query.teamSlug));
    if (!team) throw new TeamNotFoundError(query.teamSlug);

    const decks = await this.decks.listAvailableFor(team.id);
    return decks.map(toDeckSummaryView);
  }
}
