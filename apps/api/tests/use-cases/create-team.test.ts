import { describe, expect, it } from 'vitest';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { TeamSlug } from '../../src/domain/team/TeamSlug.js';
import { makeContext } from './support/context.js';

function makeUseCase(ctx: ReturnType<typeof makeContext>): CreateTeam {
  return new CreateTeam(ctx.teams, ctx.hasher, ctx.ids);
}

describe('CreateTeam', () => {
  it('crea el equipo y lo persiste, generando un slug a partir del nombre', async () => {
    const ctx = makeContext();
    const useCase = makeUseCase(ctx);

    const result = await useCase.execute({ name: 'Backend Team' });

    expect(result.slug.startsWith('backend-team-')).toBe(true);
    const stored = await ctx.teams.findBySlug(TeamSlug.of(result.slug));
    expect(stored?.name.value).toBe('Backend Team');
  });

  it('el token devuelto en claro coincide con el hash guardado', async () => {
    const ctx = makeContext();
    const useCase = makeUseCase(ctx);

    const result = await useCase.execute({ name: 'Backend Team' });

    const stored = await ctx.teams.findBySlug(TeamSlug.of(result.slug));
    expect(stored?.hasTokenHash(ctx.hasher.hash(result.token))).toBe(true);
  });

  it('dos equipos con el mismo nombre reciben slugs distintos', async () => {
    const ctx = makeContext();
    const useCase = makeUseCase(ctx);

    const first = await useCase.execute({ name: 'Backend Team' });
    const second = await useCase.execute({ name: 'Backend Team' });

    expect(first.slug).not.toBe(second.slug);
  });
});
