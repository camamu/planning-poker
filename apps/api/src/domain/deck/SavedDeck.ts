import { DomainError } from '../shared/DomainError.js';
import type { TeamId } from '../team/TeamId.js';
import { Deck } from './Deck.js';
import { DeckId } from './DeckId.js';
import { DeckName } from './DeckName.js';

export class DeckNotOwnedByTeamError extends DomainError {
  constructor(deckId: string) {
    super(`La baraja "${deckId}" no pertenece a ese equipo.`);
  }
}

export interface SavedDeckProps {
  readonly id: DeckId;
  /** `null` = baraja de sistema, visible para todos y no editable. */
  readonly teamId: TeamId | null;
  readonly name: DeckName;
  readonly deck: Deck;
}

export interface CreateCustomDeckProps {
  readonly id: DeckId;
  readonly teamId: TeamId;
  readonly name: DeckName;
  readonly rawCards: ReadonlyArray<string>;
}

/**
 * Fila de la tabla `decks` (docs/02-decisiones-y-plan.md §2): agrupa el `Deck` (VO de cartas,
 * anónimo) con un nombre y un dueño opcional. Las dos barajas de sistema son instancias fijas
 * (`SYSTEM_DECKS`), no algo que se cree por caso de uso — solo `createCustom` requiere `teamId`,
 * lo que hace estructuralmente imposible crear una baraja personalizada sin equipo.
 */
export class SavedDeck {
  private constructor(
    readonly id: DeckId,
    readonly teamId: TeamId | null,
    readonly name: DeckName,
    private readonly deck: Deck,
  ) {}

  static createCustom(props: CreateCustomDeckProps): SavedDeck {
    return new SavedDeck(props.id, props.teamId, props.name, Deck.custom(props.rawCards));
  }

  static reconstitute(props: SavedDeckProps): SavedDeck {
    return new SavedDeck(props.id, props.teamId, props.name, props.deck);
  }

  isCustom(): boolean {
    return this.teamId !== null;
  }

  belongsTo(teamId: TeamId): boolean {
    return this.teamId !== null && this.teamId.equals(teamId);
  }

  assertOwnedBy(teamId: TeamId): void {
    if (!this.belongsTo(teamId)) throw new DeckNotOwnedByTeamError(this.id.value);
  }

  currentDeck(): Deck {
    return this.deck;
  }
}

/**
 * IDs fijos, sembrados una vez por la migración `0003_teams_and_decks.ts` (no vía
 * `on conflict`: las migraciones de Kysely no se re-ejecutan). Mismo valor a los dos lados para
 * que `DeckRepository.findById` resuelva las mismas dos barajas en Postgres y en memoria.
 */
export const SYSTEM_DECK_IDS = {
  fibonacci: DeckId.of('00000000-0000-0000-0000-000000000001'),
  tshirt: DeckId.of('00000000-0000-0000-0000-000000000002'),
} as const;

export const SYSTEM_DECKS: ReadonlyArray<SavedDeck> = [
  SavedDeck.reconstitute({
    id: SYSTEM_DECK_IDS.fibonacci,
    teamId: null,
    name: DeckName.of('Fibonacci'),
    deck: Deck.fibonacci(),
  }),
  SavedDeck.reconstitute({
    id: SYSTEM_DECK_IDS.tshirt,
    teamId: null,
    name: DeckName.of('Tallas'),
    deck: Deck.tshirt(),
  }),
];
