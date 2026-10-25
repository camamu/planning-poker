import { describe, expect, it } from 'vitest';
import { HatChangeNotAllowedError, ParticipantNotFoundError } from '../../src/domain/game/Game.js';
import { Hat, UnknownHatError } from '../../src/domain/game/Hat.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

function hatOf(game: ReturnType<typeof createGame>['game'], id: string): string | undefined {
  return game
    .allParticipants()
    .find((participant) => participant.id.value === id)
    ?.currentHat()?.id;
}

describe('sombreros de avatar', () => {
  it('cada participante empieza sin sombrero', () => {
    const { game, facilitatorId } = createGame();

    expect(hatOf(game, facilitatorId.value)).toBeUndefined();
  });

  it('un participante puede ponerse y quitarse su propio sombrero', () => {
    const { game } = createGame();
    const voterId = addVoter(game);

    game.changeParticipantHat(voterId, Hat.of('cowboy'), voterId, NOW);
    expect(hatOf(game, voterId.value)).toBe('cowboy');

    game.changeParticipantHat(voterId, null, voterId, NOW);
    expect(hatOf(game, voterId.value)).toBeUndefined();
  });

  it('no permite cambiar el sombrero de otro participante, ni siendo facilitador', () => {
    const { game, facilitatorId } = createGame();
    const voterId = addVoter(game);

    expect(() => {
      game.changeParticipantHat(voterId, Hat.of('crown'), facilitatorId, NOW);
    }).toThrow(HatChangeNotAllowedError);
  });

  it('permite cambiar de sombrero con una ronda abierta', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);

    game.changeParticipantHat(facilitatorId, Hat.of('propeller'), facilitatorId, NOW);

    expect(hatOf(game, facilitatorId.value)).toBe('propeller');
  });

  it('no permite cambiar el sombrero a quien ya salió de la partida', () => {
    const { game } = createGame();
    const voterId = addVoter(game);
    game.removeParticipant(voterId, voterId, NOW);

    expect(() => {
      game.changeParticipantHat(voterId, Hat.of('wizard'), voterId, NOW);
    }).toThrow(ParticipantNotFoundError);
  });

  it('emite ParticipantHatChanged con el sombrero nuevo', () => {
    const { game, facilitatorId } = createGame();
    game.pullDomainEvents();

    game.changeParticipantHat(facilitatorId, Hat.of('pirate'), facilitatorId, NOW);

    const events = game.pullDomainEvents();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.type).toBe('ParticipantHatChanged');
    if (event?.type === 'ParticipantHatChanged') expect(event.hat?.id).toBe('pirate');
  });

  it('no acepta un sombrero fuera del catálogo', () => {
    expect(() => Hat.of('sombrero-de-copa-invisible')).toThrow(UnknownHatError);
  });
});
