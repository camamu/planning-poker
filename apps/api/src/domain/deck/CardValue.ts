import { DomainError } from '../shared/DomainError.js';

const SPECIAL_RAW_VALUES = ['?', '☕'];

export class InvalidCardValueError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un valor de carta válido: no puede estar vacío.`);
  }
}

export class CardValue {
  private constructor(
    readonly raw: string,
    readonly numeric: number | null,
    readonly special: boolean,
  ) {}

  static of(raw: string): CardValue {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidCardValueError(raw);
    if (SPECIAL_RAW_VALUES.includes(trimmed)) return new CardValue(trimmed, null, true);
    const parsed = Number(trimmed);
    return new CardValue(trimmed, Number.isFinite(parsed) ? parsed : null, false);
  }

  countsForAverage(): boolean {
    return !this.special && this.numeric !== null;
  }

  equals(other: CardValue): boolean {
    return this.raw === other.raw;
  }
}
