import type { TeamRepository } from '../../../application/ports/TeamRepository.js';
import type { Team } from '../../../domain/team/Team.js';
import type { TeamId } from '../../../domain/team/TeamId.js';
import type { TeamSlug } from '../../../domain/team/TeamSlug.js';

export class InMemoryTeamRepository implements TeamRepository {
  private readonly teams = new Map<string, Team>();

  findBySlug(slug: TeamSlug): Promise<Team | undefined> {
    return Promise.resolve([...this.teams.values()].find((team) => team.slug.equals(slug)));
  }

  findById(id: TeamId): Promise<Team | undefined> {
    return Promise.resolve(this.teams.get(id.value));
  }

  listAll(): Promise<ReadonlyArray<Team>> {
    return Promise.resolve(
      [...this.teams.values()].sort((a, b) => a.name.value.localeCompare(b.name.value)),
    );
  }

  save(team: Team): Promise<void> {
    this.teams.set(team.id.value, team);
    return Promise.resolve();
  }

  delete(id: TeamId): Promise<void> {
    this.teams.delete(id.value);
    return Promise.resolve();
  }
}
