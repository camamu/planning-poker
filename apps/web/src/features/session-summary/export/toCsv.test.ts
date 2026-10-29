import { describe, expect, it } from 'vitest';
import { parseIssueInput } from '../../issue-import/parseIssueInput.js';
import { gameSummary, summaryIssue } from './summaryFixtures.js';
import { toCsv } from './toCsv.js';

function lines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n');
}

describe('toCsv', () => {
  it('empieza con el BOM de UTF-8 para que Excel lo lea con sus tildes', () => {
    expect(toCsv(gameSummary()).startsWith('\uFEFF')).toBe(true);
  });

  it('usa punto y coma por defecto y la cabecera de columnas del plan', () => {
    expect(lines(toCsv(gameSummary()))[0]).toBe(
      'summary;key;description;link;estimate;rounds;agreement',
    );
  });

  it('separa con comas cuando se pide', () => {
    const csv = toCsv(gameSummary(), { separator: ',' });

    expect(lines(csv)[0]).toBe('summary,key,description,link,estimate,rounds,agreement');
    expect(lines(csv)[1]).toBe('Login,,,,5,1,100');
  });

  it('escribe una fila por tarea con estimación, rondas y acuerdo', () => {
    const csv = toCsv(
      gameSummary({
        issues: [
          summaryIssue({ title: 'Login', finalEstimate: '5', rounds: 1, agreementPercentage: 100 }),
          summaryIssue({
            id: 'b',
            title: 'Pagos',
            finalEstimate: '13',
            rounds: 3,
            agreementPercentage: 40,
          }),
        ],
      }),
    );

    expect(lines(csv).slice(1, 3)).toEqual(['Login;;;;5;1;100', 'Pagos;;;;13;3;40']);
  });

  it('deja vacíos la estimación y el acuerdo de una tarea sin estimar', () => {
    const csv = toCsv(
      gameSummary({
        issues: [
          summaryIssue({
            title: 'Pendiente',
            status: 'PENDING',
            finalEstimate: null,
            rounds: 0,
            agreementPercentage: null,
          }),
        ],
      }),
    );

    expect(lines(csv)[1]).toBe('Pendiente;;;;;0;');
  });

  it('rellena key y link a partir del enlace de la tarea', () => {
    const csv = toCsv(
      gameSummary({
        issues: [
          summaryIssue({
            title: 'Login',
            externalUrl: 'https://acme.atlassian.net/browse/ABC-123',
          }),
        ],
      }),
    );

    expect(lines(csv)[1]).toBe('Login;ABC-123;;https://acme.atlassian.net/browse/ABC-123;5;1;100');
  });

  it('entrecomilla los títulos con separador, comillas y saltos de línea', () => {
    const csv = toCsv(
      gameSummary({
        issues: [
          summaryIssue({ id: 'a', title: 'Login; logout' }),
          summaryIssue({ id: 'b', title: 'Pantalla "nueva"' }),
          summaryIssue({ id: 'c', title: 'Dos\nlíneas', description: 'a, b' }),
        ],
      }),
    );

    expect(csv).toContain('"Login; logout";;;;5;1;100');
    expect(csv).toContain('"Pantalla ""nueva""";;;;5;1;100');
    expect(csv).toContain('"Dos\nlíneas";;a, b;;5;1;100');
  });

  it('entrecomilla las comas solo cuando el separador es la coma', () => {
    const issues = [summaryIssue({ title: 'Login, logout y registro' })];

    expect(toCsv(gameSummary({ issues }))).toContain('Login, logout y registro;');
    expect(toCsv(gameSummary({ issues }), { separator: ',' })).toContain(
      '"Login, logout y registro",',
    );
  });

  it('desactiva con un apóstrofo las celdas que una hoja de cálculo ejecutaría como fórmula', () => {
    const csv = toCsv(
      gameSummary({
        issues: [
          summaryIssue({ id: 'a', title: '=HYPERLINK("http://evil.example","pulsa")' }),
          summaryIssue({ id: 'b', title: '@SUM(1+1)', description: '+cmd|calc' }),
          summaryIssue({ id: 'c', title: '-2+3' }),
        ],
      }),
    );

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""pulsa"")"`);
    expect(csv).toContain(`'@SUM(1+1);;'+cmd|calc;`);
    expect(csv).toContain(`'-2+3;`);
  });

  it('no toca los números ni las celdas que no empiezan como una fórmula', () => {
    const csv = toCsv(gameSummary({ issues: [summaryIssue({ title: 'Login = ok' })] }));

    expect(lines(csv)[1]).toBe('Login = ok;;;;5;1;100');
  });

  it('termina cada fila con CRLF, como pide RFC 4180', () => {
    const csv = toCsv(gameSummary());

    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replaceAll('\r\n', '').includes('\n')).toBe(false);
  });

  it('un CSV exportado se importa recuperando títulos, descripciones y enlaces', () => {
    const issues = [
      summaryIssue({
        id: 'a',
        title: 'Login; con "SSO", y más',
        description: 'Primera línea\nsegunda línea',
        externalUrl: 'https://acme.atlassian.net/browse/ABC-123',
      }),
      summaryIssue({ id: 'b', title: 'Pagos' }),
      summaryIssue({
        id: 'c',
        title: 'Informe',
        externalUrl: 'https://github.com/acme/app/issues/42',
      }),
    ];
    const expected = [
      {
        title: 'Login; con "SSO", y más',
        description: 'Primera línea\nsegunda línea',
        externalUrl: 'https://acme.atlassian.net/browse/ABC-123',
      },
      { title: 'Pagos' },
      { title: 'Informe', externalUrl: 'https://github.com/acme/app/issues/42' },
    ];

    expect(parseIssueInput(toCsv(gameSummary({ issues })))).toEqual(expected);
    expect(parseIssueInput(toCsv(gameSummary({ issues }), { separator: ',' }))).toEqual(expected);
  });
});
