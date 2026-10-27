import { describe, expect, it } from 'vitest';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import {
  FacilitatorCannotLeaveError,
  FacilitatorPresenceUnknownError,
  FacilitatorStillPresentError,
  FacilitatorTransferNotAllowedError,
  Game,
  GameWithoutFacilitatorError,
  ParticipantNotFoundError,
  RevealNotAllowedError,
  SettingsChangeNotAllowedError,
} from '../../src/domain/game/Game.js';
import { GameName } from '../../src/domain/game/GameName.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { Participant } from '../../src/domain/game/Participant.js';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { NOW, addIssueAndOpenRound, addVoter, createGame } from './support/gameFixtures.js';

function facilitatorsOf(game: Game): string[] {
  return game
    .allParticipants()
    .filter((participant) => participant.isFacilitator)
    .map((participant) => participant.id.value);
}

describe('ceder el facilitador', () => {
  it('solo el facilitador puede cederlo', () => {
    const { game } = createGame();
    const ana = addVoter(game, 'Ana');
    const bea = addVoter(game, 'Bea');

    expect(() => {
      game.transferFacilitator(bea, ana, NOW);
    }).toThrow(FacilitatorTransferNotAllowedError);
    expect(facilitatorsOf(game)).toHaveLength(1);
  });

  it('pasa el rol al elegido y registra FacilitatorChanged con quién lo tenía y quién lo tiene', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    game.pullDomainEvents();

    game.transferFacilitator(ana, facilitatorId, NOW);

    expect(facilitatorsOf(game)).toEqual([ana.value]);
    expect(game.pullDomainEvents()).toEqual([
      {
        type: 'FacilitatorChanged',
        occurredAt: NOW,
        gameId: game.id,
        previousId: facilitatorId,
        nextId: ana,
      },
    ]);
  });

  it('tras ceder, el anterior pierde los permisos de facilitador', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.transferFacilitator(ana, facilitatorId, NOW);

    expect(() => {
      game.reveal(facilitatorId, NOW);
    }).toThrow(RevealNotAllowedError);
    expect(() => {
      game.updateSettings(
        GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' }),
        facilitatorId,
        NOW,
      );
    }).toThrow(SettingsChangeNotAllowedError);
  });

  it('tras ceder, el nuevo facilitador es el único que revela con FACILITATOR_ONLY', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'FACILITATOR_ONLY' });
    const ana = addVoter(game, 'Ana');
    const bea = addVoter(game, 'Bea');
    addIssueAndOpenRound(game);
    game.castVote(ana, CardValue.of('5'), NOW);
    game.transferFacilitator(ana, facilitatorId, NOW);

    expect(game.canReveal(facilitatorId)).toBe(false);
    expect(game.canReveal(bea)).toBe(false);
    expect(game.canReveal(ana)).toBe(true);
    game.reveal(ana, NOW);
    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('tras ceder, el nuevo facilitador puede cambiar los ajustes', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    game.transferFacilitator(ana, facilitatorId, NOW);

    game.updateSettings(GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' }), ana, NOW);

    expect(game.currentSettings().autoReveal).toBe(true);
  });

  it('tras ceder, el anterior facilitador ya puede salir de la partida', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    expect(() => {
      game.removeParticipant(facilitatorId, facilitatorId, NOW);
    }).toThrow(FacilitatorCannotLeaveError);

    game.transferFacilitator(ana, facilitatorId, NOW);
    game.removeParticipant(facilitatorId, facilitatorId, NOW);

    expect(game.hasParticipantLeft(facilitatorId)).toBe(true);
    expect(facilitatorsOf(game)).toEqual([ana.value]);
  });

  it('no se puede ceder a quien ha salido', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.transferFacilitator(ana, facilitatorId, NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(facilitatorsOf(game)).toEqual([facilitatorId.value]);
  });

  it('no se puede ceder a alguien que no está en la partida', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.transferFacilitator(ParticipantId.of('desconocido'), facilitatorId, NOW);
    }).toThrow(ParticipantNotFoundError);
  });

  it('cederse el rol a uno mismo no cambia nada ni registra eventos', () => {
    const { game, facilitatorId } = createGame();
    game.pullDomainEvents();

    game.transferFacilitator(facilitatorId, facilitatorId, NOW);

    expect(facilitatorsOf(game)).toEqual([facilitatorId.value]);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('permite ceder a un espectador', () => {
    const { game, facilitatorId } = createGame();
    const mirona = ParticipantId.of('mirona');
    game.addParticipant(mirona, DisplayName.of('Mirona'), 'SPECTATOR', NOW);

    game.transferFacilitator(mirona, facilitatorId, NOW);

    expect(facilitatorsOf(game)).toEqual([mirona.value]);
  });

  it('no toca la lista de quienes pueden revelar al ceder', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    const bea = addVoter(game, 'Bea');
    game.updateSettings(
      GameSettings.of({ autoReveal: false, whoCanReveal: 'NAMED_LIST', namedRevealers: [bea] }),
      facilitatorId,
      NOW,
    );

    game.transferFacilitator(ana, facilitatorId, NOW);

    expect(game.currentSettings().namedRevealers.map((id) => id.value)).toEqual([bea.value]);
  });
});

describe('tomar el relevo del facilitador', () => {
  it('se puede tomar el relevo si el facilitador no está presente', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    game.pullDomainEvents();

    game.claimFacilitator(ana, NOW, [ana]);

    expect(facilitatorsOf(game)).toEqual([ana.value]);
    expect(game.pullDomainEvents()).toEqual([
      {
        type: 'FacilitatorChanged',
        occurredAt: NOW,
        gameId: game.id,
        previousId: facilitatorId,
        nextId: ana,
      },
    ]);
  });

  it('no se puede tomar el relevo si el facilitador está presente', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');

    expect(() => {
      game.claimFacilitator(ana, NOW, [facilitatorId, ana]);
    }).toThrow(FacilitatorStillPresentError);
    expect(facilitatorsOf(game)).toEqual([facilitatorId.value]);
  });

  it('no se puede tomar el relevo sin saber quién está presente', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');

    expect(() => {
      game.claimFacilitator(ana, NOW);
    }).toThrow(FacilitatorPresenceUnknownError);
    expect(facilitatorsOf(game)).toEqual([facilitatorId.value]);
  });

  it('el facilitador no puede tomar el relevo de sí mismo aunque no figure como presente', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.claimFacilitator(facilitatorId, NOW, []);
    }).toThrow(FacilitatorStillPresentError);
  });

  it('quien ha salido no puede tomar el relevo', () => {
    const { game } = createGame();
    const ana = addVoter(game, 'Ana');
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.claimFacilitator(ana, NOW, []);
    }).toThrow(ParticipantNotFoundError);
  });

  it('un espectador también puede tomar el relevo', () => {
    const { game } = createGame();
    const mirona = ParticipantId.of('mirona');
    game.addParticipant(mirona, DisplayName.of('Mirona'), 'SPECTATOR', NOW);

    game.claimFacilitator(mirona, NOW, [mirona]);

    expect(facilitatorsOf(game)).toEqual([mirona.value]);
  });

  it('el facilitador anterior vuelve como participante normal', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    game.claimFacilitator(ana, NOW, [ana]);

    expect(() => {
      game.updateSettings(
        GameSettings.of({ autoReveal: true, whoCanReveal: 'ANYONE' }),
        facilitatorId,
        NOW,
      );
    }).toThrow(SettingsChangeNotAllowedError);
  });

  it('falla con una partida reconstituida que no tiene facilitador', () => {
    const ana = ParticipantId.of('ana');
    const game = Game.reconstitute({
      id: GameId.of('sin-facilitador'),
      name: GameName.of('Sprint 42'),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      participants: [Participant.join(ana, DisplayName.of('Ana'), 'VOTER', false, 0)],
      issues: [],
      rounds: [],
    });

    expect(() => {
      game.claimFacilitator(ana, NOW, []);
    }).toThrow(GameWithoutFacilitatorError);
  });
});
