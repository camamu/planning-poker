import { describe, expect, it } from 'vitest';
import { InvalidTeamNameError } from '../../src/domain/team/TeamName.js';
import { InvalidTeamSlugError, TeamSlug } from '../../src/domain/team/TeamSlug.js';
import { Team } from '../../src/domain/team/Team.js';
import { TeamId } from '../../src/domain/team/TeamId.js';
import { TeamName } from '../../src/domain/team/TeamName.js';

function makeTeam(tokenHash = 'hash-1'): Team {
  return Team.create({
    id: TeamId.of('team-1'),
    slug: TeamSlug.of('backend-team'),
    name: TeamName.of('Backend Team'),
    tokenHash,
  });
}

describe('TeamSlug', () => {
  it('rechaza un slug con mayúsculas, espacios o símbolos', () => {
    expect(() => TeamSlug.of('Backend Team!')).toThrow(InvalidTeamSlugError);
  });

  it('rechaza un slug con guion al principio o al final', () => {
    expect(() => TeamSlug.of('-backend-')).toThrow(InvalidTeamSlugError);
  });

  it('acepta minúsculas, dígitos y guiones internos', () => {
    expect(TeamSlug.of('backend-team-2').value).toBe('backend-team-2');
  });
});

describe('TeamName', () => {
  it('no permite un nombre de equipo vacío', () => {
    expect(() => TeamName.of('   ')).toThrow(InvalidTeamNameError);
  });
});

describe('Team.hasTokenHash', () => {
  it('reconoce el hash de token correcto', () => {
    const team = makeTeam('hash-correcto');
    expect(team.hasTokenHash('hash-correcto')).toBe(true);
  });

  it('rechaza un hash de token distinto', () => {
    const team = makeTeam('hash-correcto');
    expect(team.hasTokenHash('otro-hash')).toBe(false);
  });
});

describe('Team.rename', () => {
  it('renombrar un equipo conserva su slug para no romper los enlaces repartidos', () => {
    const renamed = makeTeam().rename(TeamName.of('Plataforma'));

    expect(renamed.name.value).toBe('Plataforma');
    expect(renamed.slug.value).toBe('backend-team');
    expect(renamed.hasTokenHash('hash-1')).toBe(true);
  });
});

describe('Team.rotateToken', () => {
  it('regenerar el token invalida el anterior', () => {
    const rotated = makeTeam('hash-viejo').rotateToken('hash-nuevo');

    expect(rotated.hasTokenHash('hash-viejo')).toBe(false);
    expect(rotated.hasTokenHash('hash-nuevo')).toBe(true);
    expect(rotated.slug.value).toBe('backend-team');
  });
});
