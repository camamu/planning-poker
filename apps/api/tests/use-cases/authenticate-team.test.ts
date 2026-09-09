import { describe, expect, it } from 'vitest';
import { AuthenticateTeam } from '../../src/application/use-cases/AuthenticateTeam.js';
import { CreateTeam } from '../../src/application/use-cases/CreateTeam.js';
import { TeamNotFoundError } from '../../src/application/use-cases/TeamNotFoundError.js';
import { makeContext } from './support/context.js';

describe('AuthenticateTeam', () => {
  it('resuelve el equipo cuando el token es correcto', async () => {
    const ctx = makeContext();
    const created = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({
      name: 'Backend Team',
    });

    const result = await new AuthenticateTeam(ctx.teams, ctx.hasher).execute({
      slug: created.slug,
      token: created.token,
    });

    expect(result.name).toBe('Backend Team');
    expect(result.slug).toBe(created.slug);
  });

  it('lanza TeamNotFoundError si el token no coincide', async () => {
    const ctx = makeContext();
    const created = await new CreateTeam(ctx.teams, ctx.hasher, ctx.ids).execute({
      name: 'Backend Team',
    });

    await expect(
      new AuthenticateTeam(ctx.teams, ctx.hasher).execute({
        slug: created.slug,
        token: 'token-equivocado',
      }),
    ).rejects.toThrow(TeamNotFoundError);
  });

  it('lanza TeamNotFoundError si el slug no existe', async () => {
    const ctx = makeContext();

    await expect(
      new AuthenticateTeam(ctx.teams, ctx.hasher).execute({
        slug: 'no-existe',
        token: 'cualquiera',
      }),
    ).rejects.toThrow(TeamNotFoundError);
  });
});
