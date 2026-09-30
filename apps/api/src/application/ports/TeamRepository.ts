import type { Team } from '../../domain/team/Team.js';
import type { TeamId } from '../../domain/team/TeamId.js';
import type { TeamSlug } from '../../domain/team/TeamSlug.js';

export interface TeamRepository {
  findBySlug(slug: TeamSlug): Promise<Team | undefined>;
  findById(id: TeamId): Promise<Team | undefined>;
  /** Ordenados por nombre. */
  listAll(): Promise<ReadonlyArray<Team>>;
  save(team: Team): Promise<void>;
  delete(id: TeamId): Promise<void>;
}
