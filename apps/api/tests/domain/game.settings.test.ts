import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import {
  SettingsChangeNotAllowedError,
  VoteChangeNotAllowedError,
} from '../../src/domain/game/Game.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { ParticipantId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

describe('ajuste "cambiar el voto tras votar" (allowVoteChange)', () => {
  it('no permite cambiar el voto si el ajuste lo impide', () => {
    const { game, facilitatorId } = createGame({ allowVoteChange: false });
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    expect(() => {
      game.castVote(facilitatorId, CardValue.of('8'), NOW);
    }).toThrow(VoteChangeNotAllowedError);
  });

  it('permite repetir la misma carta aunque el cambio de voto esté desactivado', () => {
    const { game, facilitatorId } = createGame({ allowVoteChange: false });
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    expect(() => {
      game.castVote(facilitatorId, CardValue.of('5'), NOW);
    }).not.toThrow();
  });

  it('con el ajuste activado (valor por defecto), revotar sustituye el voto sin lanzar', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    expect(() => {
      game.castVote(facilitatorId, CardValue.of('8'), NOW);
    }).not.toThrow();
  });
});

describe('Game.updateSettings', () => {
  it('solo el facilitador puede cambiar los ajustes de la partida', () => {
    const { game } = createGame();
    const voterId = addVoter(game);
    const newSettings = GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' });

    expect(() => {
      game.updateSettings(newSettings, voterId, NOW);
    }).toThrow(SettingsChangeNotAllowedError);
  });

  it('el facilitador puede cambiar los ajustes y quedan aplicados de inmediato', () => {
    const { game, facilitatorId } = createGame();
    const newSettings = GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' });

    game.updateSettings(newSettings, facilitatorId, NOW);

    expect(game.currentSettings().autoReveal).toBe(true);
    expect(game.currentSettings().whoCanReveal).toBe('ANYONE');
  });

  it('emite GameSettingsChanged', () => {
    const { game, facilitatorId } = createGame();
    game.pullDomainEvents();
    const newSettings = GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' });

    game.updateSettings(newSettings, facilitatorId, NOW);

    const events = game.pullDomainEvents();
    expect(events.map((event) => event.type)).toEqual(['GameSettingsChanged']);
  });

  it('lanza ParticipantNotFoundError si quien pide el cambio no está en la partida', () => {
    const { game } = createGame();
    const newSettings = GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' });

    expect(() => {
      game.updateSettings(newSettings, ParticipantId.of('fantasma'), NOW);
    }).toThrow();
  });
});
