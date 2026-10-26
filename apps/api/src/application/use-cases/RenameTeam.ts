import { TeamName } from '../../domain/team/TeamName.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { loadTeam } from './loadTeam.js';

export interface RenameTeamCommand {
  readonly teamId: string;
  readonly name: string;
}

export class RenameTeam {
  constructor(private readonly teams: TeamRepository) {}

  async execute(command: RenameTeamCommand): Promise<void> {
    const team = await loadTeam(this.teams, command.teamId);
    await this.teams.save(team.rename(TeamName.of(command.name)));
  }
}
