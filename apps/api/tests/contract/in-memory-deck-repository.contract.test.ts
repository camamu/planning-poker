import { InMemoryDeckRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryDeckRepository.js';
import { defineDeckRepositoryContractTests } from './support/deckRepositoryContract.js';

defineDeckRepositoryContractTests(() => new InMemoryDeckRepository());
