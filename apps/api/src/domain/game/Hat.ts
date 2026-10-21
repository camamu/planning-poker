import { DomainError } from '../shared/DomainError.js';

/**
 * Catálogo cerrado: el front dibuja cada sombrero a mano (design-system/components/Hat), así que
 * un id que no esté aquí no tendría con qué pintarse. Ver docs/adr/0017-sombreros-de-avatar.md.
 */
export const HAT_IDS = [
  'cowboy',
  'wizard',
  'propeller',
  'crown',
  'top-hat',
  'party',
  'pirate',
  'viking',
  'chef',
] as const;

export type HatId = (typeof HAT_IDS)[number];

export class UnknownHatError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un sombrero conocido.`);
  }
}

export class Hat {
  private constructor(readonly id: HatId) {}

  static of(raw: string): Hat {
    const id = HAT_IDS.find((candidate) => candidate === raw);
    if (!id) throw new UnknownHatError(raw);
    return new Hat(id);
  }

  equals(other: Hat): boolean {
    return this.id === other.id;
  }
}
