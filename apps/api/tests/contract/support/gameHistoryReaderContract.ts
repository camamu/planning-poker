import { describe, expect, it } from 'vitest';
import type { GameHistoryReader } from '../../../src/application/ports/GameHistoryReader.js';
import type { TeamRepository } from '../../../src/application/ports/TeamRepository.js';
import { CardValue } from '../../../src/domain/deck/CardValue.js';
import { Deck } from '../../../src/domain/deck/Deck.js';
import { DisplayName } from '../../../src/domain/game/DisplayName.js';
import { Game } from '../../../src/domain/game/Game.js';
import { GameName } from '../../../src/domain/game/GameName.js';
import { GameSettings } from '../../../src/domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../../src/domain/game/ids.js';
import { Team } from '../../../src/domain/team/Team.js';
import { TeamId } from '../../../src/domain/team/TeamId.js';
import { TeamName } from '../../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../../src/domain/team/TeamSlug.js';

const NOW = new Date('2026-08-07T10:00:00Z');

export interface GameHistoryHarness {
  readonly reader: GameHistoryReader;
  readonly teams: TeamRepository;
  /** Guarda la partida fijando su fecha de creación: el agregado no la conoce, la pone el adaptador. */
  readonly saveGameCreatedAt: (game: Game, createdAt: Date) => Promise<void>;
}

function newTeam(slug: string): Team {
  return Team.create({
    id: TeamId.of(`team-${slug}`),
    slug: TeamSlug.of(slug),
    name: TeamName.of(`Equipo ${slug}`),
    tokenHash: 'hash',
  });
}

function newGame(id: string, team: Team | null, name = `Partida ${id}`): Game {
  return Game.create(
    {
      id: GameId.of(id),
      name: GameName.of(name),
      deck: Deck.fibonacci(),
      settings: GameSettings.of({ autoReveal: false, whoCanReveal: 'FACILITATOR_ONLY' }),
      facilitatorId: ParticipantId.of(`${id}-facilitator`),
      facilitatorName: DisplayName.of('Ada'),
      ...(team ? { teamId: team.id } : {}),
    },
    NOW,
  );
}

function minutesAfterNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

/** Suite compartida: se ejecuta contra InMemoryGameHistoryReader y PostgresGameHistoryReader. */
export function defineGameHistoryReaderContractTests(
  makeHarness: () => GameHistoryHarness | Promise<GameHistoryHarness>,
): void {
  describe('GameHistoryReader', () => {
    it('solo devuelve las partidas del equipo pedido', async () => {
      const { reader, teams, saveGameCreatedAt } = await makeHarness();
      const backend = newTeam('backend');
      const mobile = newTeam('mobile');
      await teams.save(backend);
      await teams.save(mobile);
      await saveGameCreatedAt(newGame('game-backend', backend), minutesAfterNow(1));
      await saveGameCreatedAt(newGame('game-mobile', mobile), minutesAfterNow(2));
      await saveGameCreatedAt(newGame('game-sin-equipo', null), minutesAfterNow(3));

      const games = await reader.listTeamGames(backend.id, { limit: 20 });

      expect(games.map((game) => game.id)).toEqual(['game-backend']);
    });

    it('devuelve una lista vacía si el equipo no tiene partidas', async () => {
      const { reader, teams } = await makeHarness();
      const backend = newTeam('backend');
      await teams.save(backend);

      await expect(reader.listTeamGames(backend.id, { limit: 20 })).resolves.toEqual([]);
    });

    it('ordena de la partida más reciente a la más antigua', async () => {
      const { reader, teams, saveGameCreatedAt } = await makeHarness();
      const backend = newTeam('backend');
      await teams.save(backend);
      await saveGameCreatedAt(newGame('game-b', backend), minutesAfterNow(2));
      await saveGameCreatedAt(newGame('game-a', backend), minutesAfterNow(1));
      await saveGameCreatedAt(newGame('game-c', backend), minutesAfterNow(3));

      const games = await reader.listTeamGames(backend.id, { limit: 20 });

      expect(games.map((game) => game.id)).toEqual(['game-c', 'game-b', 'game-a']);
      expect(games[0]?.createdAt).toEqual(minutesAfterNow(3));
    });

    it('limit recorta la página y before devuelve la siguiente sin repetir ni saltarse ninguna', async () => {
      const { reader, teams, saveGameCreatedAt } = await makeHarness();
      const backend = newTeam('backend');
      await teams.save(backend);
      for (const [index, id] of ['game-1', 'game-2', 'game-3', 'game-4', 'game-5'].entries()) {
        await saveGameCreatedAt(newGame(id, backend), minutesAfterNow(index));
      }

      const first = await reader.listTeamGames(backend.id, { limit: 2 });
      const second = await reader.listTeamGames(backend.id, {
        limit: 2,
        before: first.at(-1)?.createdAt,
      });
      const third = await reader.listTeamGames(backend.id, {
        limit: 2,
        before: second.at(-1)?.createdAt,
      });

      expect(first.map((game) => game.id)).toEqual(['game-5', 'game-4']);
      expect(second.map((game) => game.id)).toEqual(['game-3', 'game-2']);
      expect(third.map((game) => game.id)).toEqual(['game-1']);
    });

    it('before no incluye la partida creada justo en ese instante', async () => {
      const { reader, teams, saveGameCreatedAt } = await makeHarness();
      const backend = newTeam('backend');
      await teams.save(backend);
      await saveGameCreatedAt(newGame('game-1', backend), minutesAfterNow(1));
      await saveGameCreatedAt(newGame('game-2', backend), minutesAfterNow(2));

      const games = await reader.listTeamGames(backend.id, {
        limit: 20,
        before: minutesAfterNow(2),
      });

      expect(games.map((game) => game.id)).toEqual(['game-1']);
    });

    it('cuenta las tareas, las estimadas y los participantes que siguen en la partida', async () => {
      const { reader, teams, saveGameCreatedAt } = await makeHarness();
      const backend = newTeam('backend');
      await teams.save(backend);
      const game = newGame('game-counts', backend, 'Sprint 42');
      const facilitatorId = ParticipantId.of('game-counts-facilitator');
      const leaverId = ParticipantId.of('game-counts-leaver');
      game.addParticipant(leaverId, DisplayName.of('Bea'), 'VOTER', NOW);
      game.removeParticipant(leaverId, leaverId, NOW);
      game.addIssue(IssueId.of('issue-1'), 'Implementar login', NOW);
      game.addIssue(IssueId.of('issue-2'), 'Implementar logout', NOW);
      game.startVotingRound(RoundId.of('round-1'), IssueId.of('issue-1'), NOW);
      game.castVote(facilitatorId, CardValue.of('8'), NOW);
      game.reveal(facilitatorId, NOW);
      game.setFinalEstimate(CardValue.of('8'), facilitatorId, NOW);
      await saveGameCreatedAt(game, minutesAfterNow(1));

      const [summary] = await reader.listTeamGames(backend.id, { limit: 20 });

      expect(summary).toEqual({
        id: 'game-counts',
        name: 'Sprint 42',
        createdAt: minutesAfterNow(1),
        issueCount: 2,
        estimatedCount: 1,
        participantCount: 1,
      });
    });
  });
}
