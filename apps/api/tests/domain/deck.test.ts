import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck, DeckTooSmallError, DuplicateCardError } from '../../src/domain/deck/Deck.js';

describe('Deck', () => {
  it('rechaza una baraja con menos de dos cartas', () => {
    expect(() => Deck.of([CardValue.of('5')])).toThrow(DeckTooSmallError);
  });

  it('rechaza cartas duplicadas', () => {
    expect(() => Deck.of([CardValue.of('5'), CardValue.of('5')])).toThrow(DuplicateCardError);
  });

  it('Deck.fibonacci() incluye las siete cartas numéricas más "?" y "☕"', () => {
    const deck = Deck.fibonacci();
    const raws = deck.values().map((card) => card.raw);
    expect(raws).toEqual(['0.5', '1', '2', '3', '5', '8', '13', '?', '☕']);
    expect(deck.values().filter((card) => card.countsForAverage())).toHaveLength(7);
  });

  it('Deck.tshirt() no tiene ninguna carta numérica', () => {
    const deck = Deck.tshirt();
    const raws = deck.values().map((card) => card.raw);
    expect(raws).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']);
    expect(deck.values().every((card) => !card.countsForAverage())).toBe(true);
  });

  it('contains() reconoce cartas por valor, no por identidad', () => {
    const deck = Deck.fibonacci();
    expect(deck.contains(CardValue.of('5'))).toBe(true);
    expect(deck.contains(CardValue.of('20'))).toBe(false);
  });

  it('Deck.custom() añade "?" y "☕" siempre, aunque el usuario no las pida', () => {
    const deck = Deck.custom(['1', '2', '3']);
    expect(deck.values().map((card) => card.raw)).toEqual(['1', '2', '3', '?', '☕']);
  });

  it('Deck.custom() no duplica "?"/"☕" si el usuario ya las incluyó', () => {
    const deck = Deck.custom(['☕', '1', '?', '2']);
    expect(deck.values().map((card) => card.raw)).toEqual(['1', '2', '?', '☕']);
  });
});
