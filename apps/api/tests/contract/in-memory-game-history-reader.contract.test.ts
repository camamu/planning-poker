import { InMemoryGameHistoryReader } from '../../src/infrastructure/persistence/in-memory/InMemoryGameHistoryReader.js';
import { InMemoryGameRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { InMemoryTeamRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryTeamRepository.js';
import { defineGameHistoryReaderContractTests } from './support/gameHistoryReaderContract.js';

defineGameHistoryReaderContractTests(() => {
  let creationDate = new Date(0);
  const games = new InMemoryGameRepository(() => creationDate);
  return {
    reader: new InMemoryGameHistoryReader(games),
    teams: new InMemoryTeamRepository(),
    saveGameCreatedAt: (game, createdAt) => {
      creationDate = createdAt;
      return games.save(game);
    },
  };
});
