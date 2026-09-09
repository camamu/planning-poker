import { InMemoryTeamRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryTeamRepository.js';
import { defineTeamRepositoryContractTests } from './support/teamRepositoryContract.js';

defineTeamRepositoryContractTests(() => new InMemoryTeamRepository());
