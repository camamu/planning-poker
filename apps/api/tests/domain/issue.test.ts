import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { InvalidIssueTitleError, Issue } from '../../src/domain/game/Issue.js';
import { IssueId } from '../../src/domain/game/ids.js';

const NOW = new Date('2026-08-07T10:00:00Z');

describe('Issue', () => {
  it('nace PENDING, sin estimación final y sin fecha de estimación', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    expect(issue.currentStatus()).toBe('PENDING');
    expect(issue.currentFinalEstimate()).toBeNull();
    expect(issue.currentEstimatedAt()).toBeNull();
  });

  it('rechaza un título vacío', () => {
    expect(() => Issue.create(IssueId.of('i1'), '   ')).toThrow(InvalidIssueTitleError);
  });

  it('rename() reutiliza la validación del título de create()', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    expect(() => {
      issue.rename('   ');
    }).toThrow(InvalidIssueTitleError);
    expect(issue.title).toBe('Implementar login');
  });

  it('startVoting() la pasa a VOTING', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    issue.startVoting();
    expect(issue.currentStatus()).toBe('VOTING');
  });

  it('estimate() la pasa a ESTIMATED con la carta elegida y la hora en que se estimó', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    issue.estimate(CardValue.of('5'), NOW);
    expect(issue.currentStatus()).toBe('ESTIMATED');
    expect(issue.currentFinalEstimate()?.raw).toBe('5');
    expect(issue.currentEstimatedAt()).toBe(NOW);
  });

  it('reconstitute() reproduce el estado persistido sin repasar create()/estimate()', () => {
    const issue = Issue.reconstitute(
      IssueId.of('i1'),
      'Implementar login',
      'Descripción',
      'https://tracker/i1',
      'ESTIMATED',
      CardValue.of('8'),
      NOW,
    );

    expect(issue.currentStatus()).toBe('ESTIMATED');
    expect(issue.currentFinalEstimate()?.raw).toBe('8');
    expect(issue.currentEstimatedAt()).toBe(NOW);
    expect(issue.description).toBe('Descripción');
    expect(issue.externalUrl).toBe('https://tracker/i1');
  });
});
