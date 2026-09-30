import type { Team } from '../../domain/team/Team.js';

export type TeamRef = { readonly id: string; readonly name: string } | null;

/** Resuelve `teamId` → `{ id, name }` para las vistas del panel; un id huérfano se muestra sin equipo. */
export function teamRefResolver(teams: ReadonlyArray<Team>): (teamId: string | null) => TeamRef {
  const names = new Map(teams.map((team) => [team.id.value, team.name.value]));
  return (teamId) => {
    if (teamId === null) return null;
    const name = names.get(teamId);
    return name === undefined ? null : { id: teamId, name };
  };
}
