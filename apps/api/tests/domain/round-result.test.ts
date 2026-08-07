import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { RoundResult } from '../../src/domain/game/RoundResult.js';

function cards(...raws: string[]): CardValue[] {
  return raws.map((raw) => CardValue.of(raw));
}

describe('RoundResult', () => {
  it('calcula la distribución de votos por carta', () => {
    const result = RoundResult.from(cards('5', '5', '8'));
    expect(result.distribution.get('5')).toBe(2);
    expect(result.distribution.get('8')).toBe(1);
  });

  it('la media ignora las cartas especiales y se calcula solo con las numéricas', () => {
    const result = RoundResult.from(cards('5', '8', '?', '☕'));
    expect(result.average).toBe(6.5);
  });

  it('la media es null si ninguna carta votada es numérica', () => {
    const result = RoundResult.from(cards('XS', 'M', '?'));
    expect(result.average).toBeNull();
  });

  it('la media es null si no se ha votado ninguna carta', () => {
    expect(RoundResult.from([]).average).toBeNull();
  });

  it('mostVoted es la carta con más votos', () => {
    const result = RoundResult.from(cards('5', '5', '8'));
    expect(result.mostVoted?.raw).toBe('5');
  });

  it('agreementPercentage es el porcentaje de votos que coinciden con la más votada', () => {
    const result = RoundResult.from(cards('5', '5', '5', '8'));
    expect(result.agreementPercentage).toBe(75);
  });

  it('isUnanimous es true solo cuando todos los votos coinciden', () => {
    expect(RoundResult.from(cards('5', '5', '5')).isUnanimous).toBe(true);
    expect(RoundResult.from(cards('5', '8')).isUnanimous).toBe(false);
    expect(RoundResult.from([]).isUnanimous).toBe(false);
  });
});
