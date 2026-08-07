import { InMemoryGameRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { defineGameRepositoryContractTests } from './support/gameRepositoryContract.js';

defineGameRepositoryContractTests(() => new InMemoryGameRepository());
