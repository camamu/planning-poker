import { describe, expect, it } from 'vitest';
import type { TeamRepository } from '../../../src/application/ports/TeamRepository.js';
import { Team } from '../../../src/domain/team/Team.js';
import { TeamId } from '../../../src/domain/team/TeamId.js';
import { TeamName } from '../../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../../src/domain/team/TeamSlug.js';

function newTeam(id: string, slug: string): Team {
  return Team.create({
    id: TeamId.of(id),
    slug: TeamSlug.of(slug),
    name: TeamName.of('Backend Team'),
    tokenHash: 'hash-1',
  });
}

/** Suite compartida: se ejecuta contra InMemoryTeamRepository y PostgresTeamRepository. */
export function defineTeamRepositoryContractTests(
  makeRepository: () => TeamRepository | Promise<TeamRepository>,
): void {
  describe('TeamRepository', () => {
    it('devuelve undefined si el slug no existe', async () => {
      const repository = await makeRepository();
      await expect(repository.findBySlug(TeamSlug.of('inexistente'))).resolves.toBeUndefined();
    });

    it('guarda y recupera un equipo por slug', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-1', 'backend-team'));

      const reloaded = await repository.findBySlug(TeamSlug.of('backend-team'));
      expect(reloaded?.name.value).toBe('Backend Team');
      expect(reloaded?.hasTokenHash('hash-1')).toBe(true);
    });

    it('save() sustituye la versión anterior del mismo equipo', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-2', 'design-team'));
      await repository.save(
        Team.create({
          id: TeamId.of('team-2'),
          slug: TeamSlug.of('design-team'),
          name: TeamName.of('Design Team (renombrado)'),
          tokenHash: 'hash-2',
        }),
      );

      const reloaded = await repository.findBySlug(TeamSlug.of('design-team'));
      expect(reloaded?.name.value).toBe('Design Team (renombrado)');
      expect(reloaded?.hasTokenHash('hash-2')).toBe(true);
    });
  });
}
