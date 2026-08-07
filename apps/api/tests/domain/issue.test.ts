import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { InvalidIssueTitleError, Issue } from '../../src/domain/game/Issue.js';
import { IssueId } from '../../src/domain/game/ids.js';

describe('Issue', () => {
  it('nace PENDING y sin estimación final', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    expect(issue.currentStatus()).toBe('PENDING');
    expect(issue.currentFinalEstimate()).toBeNull();
  });

  it('rechaza un título vacío', () => {
    expect(() => Issue.create(IssueId.of('i1'), '   ')).toThrow(InvalidIssueTitleError);
  });

  it('startVoting() la pasa a VOTING', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    issue.startVoting();
    expect(issue.currentStatus()).toBe('VOTING');
  });

  it('estimate() la pasa a ESTIMATED con la carta elegida', () => {
    const issue = Issue.create(IssueId.of('i1'), 'Implementar login');
    issue.estimate(CardValue.of('5'));
    expect(issue.currentStatus()).toBe('ESTIMATED');
    expect(issue.currentFinalEstimate()?.raw).toBe('5');
  });

  it('reconstitute() reproduce el estado persistido sin repasar create()/estimate()', () => {
    const issue = Issue.reconstitute(
      IssueId.of('i1'),
      'Implementar login',
      'Descripción',
      'https://tracker/i1',
      'ESTIMATED',
      CardValue.of('8'),
    );

    expect(issue.currentStatus()).toBe('ESTIMATED');
    expect(issue.currentFinalEstimate()?.raw).toBe('8');
    expect(issue.description).toBe('Descripción');
    expect(issue.externalUrl).toBe('https://tracker/i1');
  });
});
