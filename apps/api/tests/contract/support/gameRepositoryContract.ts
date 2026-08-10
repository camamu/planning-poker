import { describe, expect, it } from 'vitest';
import type { GameRepository } from '../../../src/application/ports/GameRepository.js';
import { CardValue } from '../../../src/domain/deck/CardValue.js';
import { Deck } from '../../../src/domain/deck/Deck.js';
import { DisplayName } from '../../../src/domain/game/DisplayName.js';
import { Game } from '../../../src/domain/game/Game.js';
import { GameName } from '../../../src/domain/game/GameName.js';
import { GameSettings } from '../../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../../src/domain/game/ids.js';

const NOW = new Date('2026-08-07T10:00:00Z');

function newGame(
  id: string,
  deck: Deck = Deck.fibonacci(),
): { game: Game; facilitatorId: ParticipantId } {
  const facilitatorId = ParticipantId.of(`${id}-facilitator`);
  const game = Game.create(
    {
      id: GameId.of(id),
      name: GameName.of('Sprint 42'),
      deck,
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      facilitatorId,
      facilitatorName: DisplayName.of('Ada'),
    },
    NOW,
  );
  return { game, facilitatorId };
}

/**
 * Suite compartida: se ejecuta contra InMemoryGameRepository y PostgresGameRepository con la
 * misma factoría de partidas, para que ambos adaptadores respeten el mismo contrato de
 * GameRepository. `makeRepository` crea un repositorio nuevo (y, para Postgres, con las tablas
 * ya vacías) en cada test.
 */
export function defineGameRepositoryContractTests(
  makeRepository: () => GameRepository | Promise<GameRepository>,
): void {
  describe('GameRepository', () => {
    it('devuelve undefined si la partida no existe', async () => {
      const repository = await makeRepository();
      await expect(repository.findById(GameId.of('inexistente'))).resolves.toBeUndefined();
    });

    it('guarda y recupera una partida con su facilitador', async () => {
      const repository = await makeRepository();
      const { game, facilitatorId } = newGame('game-1');

      await repository.save(game);
      const reloaded = await repository.findById(GameId.of('game-1'));

      expect(reloaded?.currentName().value).toBe('Sprint 42');
      expect(reloaded?.allParticipants()).toHaveLength(1);
      expect(reloaded?.allParticipants()[0]?.id.equals(facilitatorId)).toBe(true);
      expect(reloaded?.canReveal(facilitatorId)).toBe(true);
    });

    it('save() sustituye la versión anterior de la misma partida', async () => {
      const repository = await makeRepository();
      const { game } = newGame('game-2');
      await repository.save(game);

      game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-2'));
      expect(reloaded?.findIssue(IssueId.of('issue-1'))).toBeDefined();
    });

    it('conserva los issues y su orden tras recargar', async () => {
      const repository = await makeRepository();
      const { game } = newGame('game-3');
      game.addIssue(IssueId.of('issue-1'), 'Primero', NOW);
      game.addIssue(IssueId.of('issue-2'), 'Segundo', NOW);
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-3'));
      expect(reloaded?.allIssues().map((issue) => issue.title)).toEqual(['Primero', 'Segundo']);
    });

    it('conserva los votos de una ronda abierta sin revelar, sin exponerlos como revelados', async () => {
      const repository = await makeRepository();
      const { game, facilitatorId } = newGame('game-4');
      game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
      game.startVotingRound(RoundId.of('round-1'), IssueId.of('issue-1'), NOW);
      game.castVote(facilitatorId, CardValue.of('5'), NOW);
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-4'));
      const round = reloaded?.currentRound();

      expect(round?.isOpen()).toBe(true);
      expect(round?.hasVoted(facilitatorId)).toBe(true);
      expect(() => round?.revealedVotes()).toThrow();
    });

    it('conserva el resultado de una ronda revelada tras recargar', async () => {
      const repository = await makeRepository();
      const { game, facilitatorId } = newGame('game-5');
      const voterId = ParticipantId.of('game-5-voter');
      game.addParticipant(voterId, DisplayName.of('Bea'), 'VOTER', NOW);
      game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
      game.startVotingRound(RoundId.of('round-1'), IssueId.of('issue-1'), NOW);
      game.castVote(facilitatorId, CardValue.of('5'), NOW);
      game.castVote(voterId, CardValue.of('5'), NOW);
      game.reveal(facilitatorId, NOW);
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-5'));
      const round = reloaded?.currentRound();

      expect(round?.isRevealed()).toBe(true);
      expect(round?.currentRevealedAt()).toEqual(NOW);
      expect(round?.revealedResult().isUnanimous).toBe(true);
      expect(round?.revealedResult().average).toBe(5);
    });

    it('conserva la estimación final de una issue cerrada tras recargar', async () => {
      const repository = await makeRepository();
      const { game, facilitatorId } = newGame('game-6');
      game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
      game.startVotingRound(RoundId.of('round-1'), IssueId.of('issue-1'), NOW);
      game.castVote(facilitatorId, CardValue.of('8'), NOW);
      game.reveal(facilitatorId, NOW);
      game.setFinalEstimate(CardValue.of('8'), NOW);
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-6'));
      const issue = reloaded?.findIssue(IssueId.of('issue-1'));

      expect(issue?.currentStatus()).toBe('ESTIMATED');
      expect(issue?.currentFinalEstimate()?.raw).toBe('8');
      expect(reloaded?.currentRound()?.currentStatus()).toBe('CLOSED');
    });

    it('conserva una baraja de tallas (sin cartas numéricas) tras recargar', async () => {
      const repository = await makeRepository();
      const { game } = newGame('game-7', Deck.tshirt());
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-7'));
      expect(reloaded?.currentDeck().contains(CardValue.of('M'))).toBe(true);
      expect(reloaded?.currentDeck().contains(CardValue.of('5'))).toBe(false);
    });

    it('conserva whoCanReveal y namedRevealers tras recargar', async () => {
      const repository = await makeRepository();
      const namedRevealer = ParticipantId.of('game-8-named');
      const game = Game.create(
        {
          id: GameId.of('game-8'),
          name: GameName.of('Sprint 42'),
          deck: Deck.fibonacci(),
          settings: GameSettings.of({
            autoReveal: true,
            whoCanReveal: 'NAMED_LIST',
            namedRevealers: [namedRevealer],
          }),
          facilitatorId: ParticipantId.of('game-8-facilitator'),
          facilitatorName: DisplayName.of('Ada'),
        },
        NOW,
      );
      await repository.save(game);

      const reloaded = await repository.findById(GameId.of('game-8'));
      expect(reloaded?.currentSettings().autoReveal).toBe(true);
      expect(reloaded?.currentSettings().whoCanReveal).toBe('NAMED_LIST');
      expect(
        reloaded?.currentSettings().namedRevealers.some((id) => id.equals(namedRevealer)),
      ).toBe(true);
    });
  });
}
