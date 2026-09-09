import { DomainError } from '../shared/DomainError.js';
import { CardValue } from './CardValue.js';

const MIN_CARDS = 2;

export class DeckTooSmallError extends DomainError {
  constructor(size: number) {
    super(
      `Una baraja necesita al menos ${MIN_CARDS.toString()} cartas, recibidas ${size.toString()}.`,
    );
  }
}

export class DuplicateCardError extends DomainError {
  constructor(raw: string) {
    super(`La carta "${raw}" está duplicada en la baraja.`);
  }
}

export class Deck {
  private constructor(private readonly cards: ReadonlyArray<CardValue>) {}

  static of(cards: ReadonlyArray<CardValue>): Deck {
    if (cards.length < MIN_CARDS) throw new DeckTooSmallError(cards.length);

    const seen = new Set<string>();
    for (const card of cards) {
      if (seen.has(card.raw)) throw new DuplicateCardError(card.raw);
      seen.add(card.raw);
    }

    return new Deck(cards);
  }

  static fibonacci(): Deck {
    return Deck.of(
      ['0.5', '1', '2', '3', '5', '8', '13', '?', '☕'].map((raw) => CardValue.of(raw)),
    );
  }

  static tshirt(): Deck {
    return Deck.of(['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'].map((raw) => CardValue.of(raw)));
  }

  /**
   * Barajas personalizadas (docs/02-decisiones-y-plan.md §2.1): "?" y "☕" se añaden siempre, al
   * final, sin que el usuario tenga que pedirlas — si ya las incluyó, no se duplican.
   */
  static custom(rawCards: ReadonlyArray<string>): Deck {
    const own = rawCards.map((raw) => CardValue.of(raw)).filter((card) => !card.special);
    return Deck.of([...own, CardValue.of('?'), CardValue.of('☕')]);
  }

  contains(card: CardValue): boolean {
    return this.cards.some((c) => c.equals(card));
  }

  values(): ReadonlyArray<CardValue> {
    return this.cards;
  }
}
