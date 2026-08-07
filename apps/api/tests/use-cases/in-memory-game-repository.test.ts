import { describe, expect, it } from 'vitest';
import { InMemoryGameRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import { Game } from '../../src/domain/game/Game.js';
import { GameName } from '../../src/domain/game/GameName.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId } from '../../src/domain/game/ids.js';

const NOW = new Date('2026-08-07T10:00:00Z');

function newGame(): Game {
  return Game.create(
    {
      id: GameId.of('game-1'),
      name: GameName.of('Sprint 42'),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      facilitatorId: ParticipantId.of('participant-1'),
      facilitatorName: DisplayName.of('Ada'),
    },
    NOW,
  );
}

describe('InMemoryGameRepository', () => {
  it('devuelve undefined si la partida no existe', async () => {
    const repository = new InMemoryGameRepository();
    await expect(repository.findById(GameId.of('inexistente'))).resolves.toBeUndefined();
  });

  it('devuelve la partida guardada por su id', async () => {
    const repository = new InMemoryGameRepository();
    const game = newGame();

    await repository.save(game);

    await expect(repository.findById(GameId.of('game-1'))).resolves.toBe(game);
  });

  it('save sustituye la versión anterior de la misma partida', async () => {
    const repository = new InMemoryGameRepository();
    const game = newGame();
    await repository.save(game);

    game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
    await repository.save(game);

    const stored = await repository.findById(GameId.of('game-1'));
    expect(stored?.findIssue(IssueId.of('issue-1'))).toBeDefined();
  });
});
