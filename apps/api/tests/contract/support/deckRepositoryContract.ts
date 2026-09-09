import { describe, expect, it } from 'vitest';
import type { DeckRepository } from '../../../src/application/ports/DeckRepository.js';
import { DeckId } from '../../../src/domain/deck/DeckId.js';
import { DeckName } from '../../../src/domain/deck/DeckName.js';
import { SYSTEM_DECK_IDS, SavedDeck } from '../../../src/domain/deck/SavedDeck.js';
import { TeamId } from '../../../src/domain/team/TeamId.js';

function newCustomDeck(id: string, teamId: string, name = 'Mi baraja'): SavedDeck {
  return SavedDeck.createCustom({
    id: DeckId.of(id),
    teamId: TeamId.of(teamId),
    name: DeckName.of(name),
    rawCards: ['1', '2', '3'],
  });
}

/**
 * Suite compartida: se ejecuta contra InMemoryDeckRepository y PostgresDeckRepository.
 * `makeRepository` debe devolver un repositorio con las dos barajas de sistema ya sembradas
 * (en memoria por el constructor, en Postgres por la migración `0003_teams_and_decks.ts`).
 */
export function defineDeckRepositoryContractTests(
  makeRepository: () => DeckRepository | Promise<DeckRepository>,
): void {
  describe('DeckRepository', () => {
    it('resuelve las dos barajas de sistema por sus IDs fijos', async () => {
      const repository = await makeRepository();

      const fibonacci = await repository.findById(SYSTEM_DECK_IDS.fibonacci);
      const tshirt = await repository.findById(SYSTEM_DECK_IDS.tshirt);

      expect(
        fibonacci
          ?.currentDeck()
          .values()
          .map((card) => card.raw),
      ).toEqual(['0.5', '1', '2', '3', '5', '8', '13', '?', '☕']);
      expect(tshirt?.isCustom()).toBe(false);
    });

    it('devuelve undefined si el id no existe', async () => {
      const repository = await makeRepository();
      await expect(repository.findById(DeckId.of('inexistente'))).resolves.toBeUndefined();
    });

    it('guarda y recupera una baraja personalizada', async () => {
      const repository = await makeRepository();
      await repository.save(newCustomDeck('deck-1', 'team-1'));

      const reloaded = await repository.findById(DeckId.of('deck-1'));
      expect(reloaded?.name.value).toBe('Mi baraja');
      expect(reloaded?.teamId?.value).toBe('team-1');
      expect(
        reloaded
          ?.currentDeck()
          .values()
          .map((card) => card.raw),
      ).toEqual(['1', '2', '3', '?', '☕']);
    });

    it('save() sustituye la versión anterior de la misma baraja', async () => {
      const repository = await makeRepository();
      await repository.save(newCustomDeck('deck-2', 'team-1', 'Primer nombre'));
      await repository.save(newCustomDeck('deck-2', 'team-1', 'Nombre renombrado'));

      const reloaded = await repository.findById(DeckId.of('deck-2'));
      expect(reloaded?.name.value).toBe('Nombre renombrado');
    });

    it('listAvailableFor(null) devuelve solo las barajas de sistema', async () => {
      const repository = await makeRepository();
      await repository.save(newCustomDeck('deck-3', 'team-1'));

      const available = await repository.listAvailableFor(null);
      expect(available.every((deck) => !deck.isCustom())).toBe(true);
      expect(available).toHaveLength(2);
    });

    it('listAvailableFor(teamId) añade las personalizadas de ese equipo, no las de otros', async () => {
      const repository = await makeRepository();
      await repository.save(newCustomDeck('deck-4', 'team-1', 'Baraja de team-1'));
      await repository.save(newCustomDeck('deck-5', 'team-2', 'Baraja de team-2'));

      const available = await repository.listAvailableFor(TeamId.of('team-1'));

      expect(available.map((deck) => deck.name.value)).toContain('Baraja de team-1');
      expect(available.map((deck) => deck.name.value)).not.toContain('Baraja de team-2');
      expect(available).toHaveLength(3);
    });

    it('delete() elimina la baraja', async () => {
      const repository = await makeRepository();
      await repository.save(newCustomDeck('deck-6', 'team-1'));

      await repository.delete(DeckId.of('deck-6'));

      await expect(repository.findById(DeckId.of('deck-6'))).resolves.toBeUndefined();
    });
  });
}
