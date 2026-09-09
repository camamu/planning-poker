import { describe, expect, it } from 'vitest';
import { CardValue, InvalidCardValueError } from '../../src/domain/deck/CardValue.js';

describe('CardValue', () => {
  it('parsea una carta numérica y la marca como contable para la media', () => {
    const card = CardValue.of('5');
    expect(card.raw).toBe('5');
    expect(card.numeric).toBe(5);
    expect(card.special).toBe(false);
    expect(card.countsForAverage()).toBe(true);
  });

  it('trata "?" y "☕" como cartas especiales que no cuentan para la media', () => {
    expect(CardValue.of('?').countsForAverage()).toBe(false);
    expect(CardValue.of('☕').countsForAverage()).toBe(false);
    expect(CardValue.of('?').numeric).toBeNull();
  });

  it('trata un valor de texto no numérico como no contable para la media', () => {
    const card = CardValue.of('XL');
    expect(card.numeric).toBeNull();
    expect(card.special).toBe(false);
    expect(card.countsForAverage()).toBe(false);
  });

  it('recorta espacios en blanco', () => {
    expect(CardValue.of('  8  ').raw).toBe('8');
  });

  it('rechaza un valor vacío', () => {
    expect(() => CardValue.of('   ')).toThrow(InvalidCardValueError);
  });

  it('compara por valor, no por identidad', () => {
    expect(CardValue.of('5').equals(CardValue.of('5'))).toBe(true);
    expect(CardValue.of('5').equals(CardValue.of('8'))).toBe(false);
  });
});
