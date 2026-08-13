import type { Team } from '../../domain/team/Team.js';
import { TeamSlug } from '../../domain/team/TeamSlug.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { TeamNotFoundError } from './TeamNotFoundError.js';

export async function resolveTeam(
  teams: TeamRepository,
  hasher: TokenHasher,
  slug: string,
  token: string,
): Promise<Team> {
  const team = await teams.findBySlug(TeamSlug.of(slug));
  if (!team || !team.hasTokenHash(hasher.hash(token))) throw new TeamNotFoundError(slug);
  return team;
}
