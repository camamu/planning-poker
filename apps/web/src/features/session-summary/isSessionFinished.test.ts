import { describe, expect, it } from 'vitest';
import { isSessionFinished } from './isSessionFinished.js';

describe('isSessionFinished', () => {
  it('es verdadero cuando no quedan pendientes y la tarea actual está estimada', () => {
    const issues = [
      { id: 'a', status: 'ESTIMATED' as const },
      { id: 'b', status: 'ESTIMATED' as const },
    ];

    expect(isSessionFinished(issues, 'b')).toBe(true);
  });

  it('es falso mientras queda alguna tarea pendiente', () => {
    const issues = [
      { id: 'a', status: 'ESTIMATED' as const },
      { id: 'b', status: 'PENDING' as const },
    ];

    expect(isSessionFinished(issues, 'a')).toBe(false);
  });

  it('es falso si la tarea actual todavía no está estimada', () => {
    const issues = [
      { id: 'a', status: 'ESTIMATED' as const },
      { id: 'b', status: 'VOTING' as const },
    ];

    expect(isSessionFinished(issues, 'b')).toBe(false);
  });

  it('es falso sin ronda actual', () => {
    expect(isSessionFinished([{ id: 'a', status: 'ESTIMATED' }], null)).toBe(false);
  });
});
