import { describe, expect, it } from 'vitest';
import { DisplayName, InvalidDisplayNameError } from '../../src/domain/game/DisplayName.js';
import { GameName, InvalidGameNameError } from '../../src/domain/game/GameName.js';
import {
  GameId,
  InvalidIdError,
  IssueId,
  ParticipantId,
  RoundId,
} from '../../src/domain/game/ids.js';

describe('identificadores de dominio (GameId, ParticipantId, IssueId, RoundId)', () => {
  it('rechazan un valor vacío', () => {
    expect(() => GameId.of('   ')).toThrow(InvalidIdError);
    expect(() => ParticipantId.of('')).toThrow(InvalidIdError);
    expect(() => IssueId.of('  ')).toThrow(InvalidIdError);
    expect(() => RoundId.of('')).toThrow(InvalidIdError);
  });

  it('comparan por valor', () => {
    expect(GameId.of('g1').equals(GameId.of('g1'))).toBe(true);
    expect(GameId.of('g1').equals(GameId.of('g2'))).toBe(false);
    expect(RoundId.of('r1').equals(RoundId.of('r1'))).toBe(true);
    expect(RoundId.of('r1').equals(RoundId.of('r2'))).toBe(false);
  });
});

describe('GameName', () => {
  it('rechaza un nombre vacío', () => {
    expect(() => GameName.of('   ')).toThrow(InvalidGameNameError);
  });

  it('recorta espacios en blanco', () => {
    expect(GameName.of('  Sprint 42  ').value).toBe('Sprint 42');
  });
});

describe('DisplayName', () => {
  it('rechaza un nombre vacío', () => {
    expect(() => DisplayName.of('   ')).toThrow(InvalidDisplayNameError);
  });

  it('recorta espacios en blanco', () => {
    expect(DisplayName.of('  Ada  ').value).toBe('Ada');
  });
});
