import type { Team } from '../../domain/team/Team.js';
import type { TeamSlug } from '../../domain/team/TeamSlug.js';

export interface TeamRepository {
  findBySlug(slug: TeamSlug): Promise<Team | undefined>;
  save(team: Team): Promise<void>;
}
