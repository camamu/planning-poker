import type { TeamRepository } from '../../../application/ports/TeamRepository.js';
import type { Team } from '../../../domain/team/Team.js';
import type { TeamSlug } from '../../../domain/team/TeamSlug.js';

export class InMemoryTeamRepository implements TeamRepository {
  private readonly teams = new Map<string, Team>();

  findBySlug(slug: TeamSlug): Promise<Team | undefined> {
    return Promise.resolve(this.teams.get(slug.value));
  }

  save(team: Team): Promise<void> {
    this.teams.set(team.slug.value, team);
    return Promise.resolve();
  }
}
