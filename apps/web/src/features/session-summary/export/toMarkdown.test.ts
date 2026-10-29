import { describe, expect, it } from 'vitest';
import { gameSummary, summaryIssue } from './summaryFixtures.js';
import { toMarkdown } from './toMarkdown.js';

describe('toMarkdown', () => {
  it('genera una tabla con cabecera, una fila por tarea y una línea de totales', () => {
    const markdown = toMarkdown(
      gameSummary({
        issues: [
          summaryIssue({
            id: 'a',
            title: 'Login',
            finalEstimate: '5',
            rounds: 1,
            agreementPercentage: 100,
          }),
          summaryIssue({
            id: 'b',
            title: 'Pagos',
            finalEstimate: '13',
            rounds: 3,
            agreementPercentage: 40,
          }),
        ],
        totals: { ...gameSummary().totals, estimatedCount: 2, points: 18 },
      }),
    );

    expect(markdown).toBe(
      [
        '| Tarea | Estimación | Rondas | Acuerdo |',
        '| --- | :---: | ---: | ---: |',
        '| Login | 5 | 1 | 100% |',
        '| Pagos | 13 | 3 | 40% |',
        '',
        '**Total:** 2 / 2 tareas estimadas · 18 puntos',
        '',
      ].join('\n'),
    );
  });

  it('enlaza el título a su URL cuando la tarea la tiene', () => {
    const markdown = toMarkdown(
      gameSummary({
        issues: [summaryIssue({ title: 'Login', externalUrl: 'https://jira.example/browse/PP-1' })],
      }),
    );

    expect(markdown).toContain('| [Login](https://jira.example/browse/PP-1) | 5 | 1 | 100% |');
  });

  it('escapa la barra vertical de los títulos para no partir la fila', () => {
    const markdown = toMarkdown(gameSummary({ issues: [summaryIssue({ title: 'Alta | baja' })] }));

    expect(markdown).toContain('| Alta \\| baja | 5 | 1 | 100% |');
  });

  it('escapa el formato Markdown y los saltos de línea de los títulos', () => {
    const markdown = toMarkdown(
      gameSummary({ issues: [summaryIssue({ title: '[WIP] *Nuevo*\nflujo_de_pago' })] }),
    );

    expect(markdown).toContain('| \\[WIP\\] \\*Nuevo\\* flujo\\_de\\_pago | 5 | 1 | 100% |');
  });

  it('codifica los paréntesis y las barras de una URL para no cerrar el enlace ni la celda', () => {
    const markdown = toMarkdown(
      gameSummary({
        issues: [
          summaryIssue({ title: 'Wiki', externalUrl: 'https://wiki.example/Page_(draft)|x' }),
        ],
      }),
    );

    expect(markdown).toContain('[Wiki](https://wiki.example/Page_%28draft%29%7Cx)');
  });

  it('muestra el estado en vez de la estimación y un guion si no hay acuerdo', () => {
    const markdown = toMarkdown(
      gameSummary({
        issues: [
          summaryIssue({
            id: 'a',
            title: 'Pendiente',
            status: 'PENDING',
            finalEstimate: null,
            rounds: 0,
            agreementPercentage: null,
          }),
          summaryIssue({
            id: 'b',
            title: 'En curso',
            status: 'VOTING',
            finalEstimate: null,
            rounds: 1,
            agreementPercentage: 60,
          }),
        ],
        totals: { ...gameSummary().totals, estimatedCount: 0, pendingCount: 2, points: null },
      }),
    );

    expect(markdown).toContain('| Pendiente | Pendiente | 0 | — |');
    expect(markdown).toContain('| En curso | En votación | 1 | 60% |');
    expect(markdown).toContain('**Total:** 0 / 2 tareas estimadas · 2 sin estimar');
  });

  it('cuenta las tallas en los totales cuando la baraja no es numérica', () => {
    const markdown = toMarkdown(
      gameSummary({
        issues: [summaryIssue({ finalEstimate: 'M' })],
        totals: { ...gameSummary().totals, points: null, nonNumericEstimates: { M: 2, L: 1 } },
      }),
    );

    expect(markdown).toContain('**Total:** 1 / 1 tareas estimadas · M ×2 · L ×1');
  });

  it('redondea los puntos a dos decimales', () => {
    const markdown = toMarkdown(
      gameSummary({ totals: { ...gameSummary().totals, points: 10.333333 } }),
    );

    expect(markdown).toContain('10.33 puntos');
  });
});
