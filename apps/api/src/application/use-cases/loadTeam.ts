import type { Team } from '../../domain/team/Team.js';
import { TeamId } from '../../domain/team/TeamId.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { TeamNotFoundError } from './TeamNotFoundError.js';

/** Por id, sin token: solo lo usa el panel de gestión, que ya ha pasado su propia autenticación. */
export async function loadTeam(teams: TeamRepository, rawId: string): Promise<Team> {
  const team = await teams.findById(TeamId.of(rawId));
  if (!team) throw new TeamNotFoundError(rawId);
  return team;
}
