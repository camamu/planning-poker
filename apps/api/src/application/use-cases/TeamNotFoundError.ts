/**
 * También se lanza cuando el token no coincide (`resolveTeam.ts`): no distinguimos "el
 * equipo no existe" de "el token es inválido" en la respuesta, para no filtrar si un slug existe.
 */
export class TeamNotFoundError extends Error {
  constructor(readonly slug: string) {
    super(`No existe el equipo "${slug}", o el token no es válido.`);
    this.name = 'TeamNotFoundError';
  }
}
