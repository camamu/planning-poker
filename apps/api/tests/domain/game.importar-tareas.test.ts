import { describe, expect, it } from 'vitest';
import { InvalidIssueTitleError } from '../../src/domain/game/Issue.js';
import type { IssueDraft } from '../../src/domain/game/Issue.js';
import { IssueId } from '../../src/domain/game/ids.js';
import { NOW, addIssueAndOpenRound, createGame, nextId } from './support/gameFixtures.js';

function draft(title: string, extra: Partial<IssueDraft> = {}): IssueDraft {
  return { id: IssueId.of(nextId('issue')), title, ...extra };
}

describe('importar tareas', () => {
  it('importar tareas no añade ninguna si un título es inválido', () => {
    const { game } = createGame();
    game.addIssue(IssueId.of(nextId('issue')), 'Ya estaba', NOW);
    game.pullDomainEvents();

    expect(() => {
      game.importIssues([draft('Primera'), draft('   '), draft('Tercera')], NOW);
    }).toThrow(InvalidIssueTitleError);

    expect(game.allIssues().map((issue) => issue.title)).toEqual(['Ya estaba']);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('importar tareas registra un único evento', () => {
    const { game } = createGame();
    game.pullDomainEvents();
    const entries = [draft('Primera'), draft('Segunda'), draft('Tercera')];

    game.importIssues(entries, NOW);

    const events = game.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'IssuesImported', gameId: game.id, occurredAt: NOW });
    expect(events[0]).toHaveProperty(
      'issueIds',
      entries.map((entry) => entry.id),
    );
  });

  it('importar tareas las añade al final de la cola, pendientes y en el orden recibido', () => {
    const { game } = createGame();
    game.addIssue(IssueId.of(nextId('issue')), 'Ya estaba', NOW);

    game.importIssues([draft('Primera'), draft('Segunda')], NOW);

    expect(game.allIssues().map((issue) => [issue.title, issue.currentStatus()])).toEqual([
      ['Ya estaba', 'PENDING'],
      ['Primera', 'PENDING'],
      ['Segunda', 'PENDING'],
    ]);
  });

  it('importar tareas conserva la descripción y el enlace de cada una', () => {
    const { game } = createGame();
    const withLink = draft('  ABC-123  ', {
      description: 'Con OAuth',
      externalUrl: 'https://jira.test/browse/ABC-123',
    });
    const plain = draft('Sin datos extra');

    game.importIssues([withLink, plain], NOW);

    const imported = game.findIssue(withLink.id);
    expect(imported?.title).toBe('ABC-123');
    expect(imported?.description).toBe('Con OAuth');
    expect(imported?.externalUrl).toBe('https://jira.test/browse/ABC-123');
    expect(game.findIssue(plain.id)?.externalUrl).toBeUndefined();
  });

  it('importar una lista vacía no cambia nada ni registra ningún evento', () => {
    const { game } = createGame();
    game.pullDomainEvents();

    game.importIssues([], NOW);

    expect(game.allIssues()).toEqual([]);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('importar tareas no toca la ronda que está abierta', () => {
    const { game } = createGame();
    addIssueAndOpenRound(game);
    const openRound = game.currentRound();

    game.importIssues([draft('Siguiente')], NOW);

    expect(game.currentRound()).toBe(openRound);
    expect(game.currentRound()?.isRevealed()).toBe(false);
  });
});

describe('añadir una tarea suelta', () => {
  it('permite añadir una tarea con descripción y enlace', () => {
    const { game } = createGame();
    const id = IssueId.of(nextId('issue'));

    game.addIssue(id, 'Implementar login', NOW, {
      description: 'Con OAuth',
      externalUrl: 'https://t/1',
    });

    expect(game.findIssue(id)?.description).toBe('Con OAuth');
    expect(game.findIssue(id)?.externalUrl).toBe('https://t/1');
  });
});
