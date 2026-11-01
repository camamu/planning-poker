import {
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_URL_LENGTH,
  addIssueCommandSchema,
} from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { parseIssueInput } from './parseIssueInput.js';

describe('parseIssueInput — lista de tareas', () => {
  it('crea una tarea por línea y recorta los espacios', () => {
    expect(parseIssueInput('Implementar login\n  Arreglar el logout  \nMigrar la BD')).toEqual([
      { title: 'Implementar login' },
      { title: 'Arreglar el logout' },
      { title: 'Migrar la BD' },
    ]);
  });

  it('ignora las líneas vacías y acepta saltos de línea de Windows', () => {
    expect(parseIssueInput('\r\nPrimera\r\n\r\n   \r\nSegunda\r\n')).toEqual([
      { title: 'Primera' },
      { title: 'Segunda' },
    ]);
  });

  it('devuelve una lista vacía si no hay nada que importar', () => {
    expect(parseIssueInput('')).toEqual([]);
    expect(parseIssueInput('  \n \n')).toEqual([]);
  });

  it('no trata como cabecera una línea que solo se parece por tener comas', () => {
    expect(parseIssueInput('Login, logout y registro\nMigrar la BD')).toEqual([
      { title: 'Login, logout y registro' },
      { title: 'Migrar la BD' },
    ]);
  });
});

describe('parseIssueInput — enlaces', () => {
  it('convierte una URL de Jira en tarea con su clave como título y el enlace', () => {
    expect(parseIssueInput('https://acme.atlassian.net/browse/ABC-123')).toEqual([
      { title: 'ABC-123', externalUrl: 'https://acme.atlassian.net/browse/ABC-123' },
    ]);
  });

  it('convierte una URL de GitHub en repo#número', () => {
    expect(parseIssueInput('https://github.com/camamu/planning-poker/issues/42')).toEqual([
      {
        title: 'planning-poker#42',
        externalUrl: 'https://github.com/camamu/planning-poker/issues/42',
      },
    ]);
  });

  it('convierte una URL de Linear en su clave', () => {
    expect(parseIssueInput('https://linear.app/acme/issue/ENG-12/arreglar-login')).toEqual([
      { title: 'ENG-12', externalUrl: 'https://linear.app/acme/issue/ENG-12/arreglar-login' },
    ]);
  });

  it('usa el último segmento del path en un enlace de otro gestor', () => {
    expect(parseIssueInput('https://wiki.acme.test/tareas/migrar-la-bd')).toEqual([
      { title: 'migrar-la-bd', externalUrl: 'https://wiki.acme.test/tareas/migrar-la-bd' },
    ]);
  });

  it('importa diez URLs de Jira como diez tareas con su clave y su enlace', () => {
    const urls = Array.from(
      { length: 10 },
      (_, index) => `https://acme.atlassian.net/browse/ABC-${(index + 1).toString()}`,
    );

    const parsed = parseIssueInput(urls.join('\n'));

    expect(parsed.map((issue) => issue.title)).toEqual(
      Array.from({ length: 10 }, (_, index) => `ABC-${(index + 1).toString()}`),
    );
    expect(parsed.map((issue) => issue.externalUrl)).toEqual(urls);
  });

  it('mezcla líneas de texto y enlaces', () => {
    expect(parseIssueInput('Preparar la demo\nhttps://acme.atlassian.net/browse/ABC-1')).toEqual([
      { title: 'Preparar la demo' },
      { title: 'ABC-1', externalUrl: 'https://acme.atlassian.net/browse/ABC-1' },
    ]);
  });

  it('deja como texto una línea que contiene un enlace pero no es solo un enlace', () => {
    expect(
      parseIssueInput('Mirar https://acme.atlassian.net/browse/ABC-1 cuando se pueda'),
    ).toEqual([{ title: 'Mirar https://acme.atlassian.net/browse/ABC-1 cuando se pueda' }]);
  });

  it('no convierte en enlace un protocolo que no es http(s)', () => {
    expect(parseIssueInput('javascript:alert(1)')).toEqual([{ title: 'javascript:alert(1)' }]);
  });
});

describe('parseIssueInput — CSV', () => {
  it('lee un CSV exportado de Jira con columna Summary sin tocarlo', () => {
    const csv = [
      'Summary,Issue key,Issue Type,Status,Description',
      'Implementar login,ABC-1,Story,To Do,Con OAuth',
      'Arreglar el logout,ABC-2,Bug,To Do,',
    ].join('\n');

    expect(parseIssueInput(csv)).toEqual([
      { title: 'Implementar login', description: 'Con OAuth' },
      { title: 'Arreglar el logout' },
    ]);
  });

  it('lee un CSV de Linear con columna Title', () => {
    const csv = ['ID,Title,Status', 'ENG-12,Arreglar el login,Todo'].join('\n');

    expect(parseIssueInput(csv)).toEqual([{ title: 'Arreglar el login' }]);
  });

  it('respeta comillas, comillas escapadas, separadores y saltos de línea dentro de una celda', () => {
    const csv =
      'summary,description\n"Login, logout y ""registro""","Primera línea\nSegunda línea"\n';

    expect(parseIssueInput(csv)).toEqual([
      { title: 'Login, logout y "registro"', description: 'Primera línea\nSegunda línea' },
    ]);
  });

  it('detecta el punto y coma como separador', () => {
    expect(parseIssueInput('summary;link\nLogin;https://acme.atlassian.net/browse/ABC-1')).toEqual([
      { title: 'Login', externalUrl: 'https://acme.atlassian.net/browse/ABC-1' },
    ]);
  });

  it('detecta el tabulador de una hoja de cálculo pegada', () => {
    expect(parseIssueInput('summary\tdescription\nLogin\tCon OAuth')).toEqual([
      { title: 'Login', description: 'Con OAuth' },
    ]);
  });

  it('entiende las cabeceras en español, con tildes y en mayúsculas', () => {
    expect(parseIssueInput('Título,Descripción,URL\nLogin,Con OAuth,https://t.test/x/1')).toEqual([
      { title: 'Login', description: 'Con OAuth', externalUrl: 'https://t.test/x/1' },
    ]);
  });

  it('ignora la columna estimate y cualquier otra que no conozca', () => {
    expect(parseIssueInput('summary,estimate,rounds,agreement\nLogin,5,2,80')).toEqual([
      { title: 'Login' },
    ]);
  });

  it('usa la clave como título si la fila no trae resumen', () => {
    expect(parseIssueInput('summary,key\n,ABC-9\nLogin,ABC-1')).toEqual([
      { title: 'ABC-9' },
      { title: 'Login' },
    ]);
  });

  it('deriva el título del enlace si la fila no trae resumen ni clave', () => {
    expect(parseIssueInput('summary,link\n,https://acme.atlassian.net/browse/ABC-7')).toEqual([
      { title: 'ABC-7', externalUrl: 'https://acme.atlassian.net/browse/ABC-7' },
    ]);
  });

  it('descarta un enlace que no es http(s) en vez de romper la importación', () => {
    expect(parseIssueInput('summary,link\nLogin,javascript:alert(1)')).toEqual([
      { title: 'Login' },
    ]);
  });

  it('salta las filas sin nada que importar y las líneas en blanco', () => {
    expect(parseIssueInput('summary,description\n\nLogin,\n,solo descripción\n\n')).toEqual([
      { title: 'Login' },
    ]);
  });

  it('lee un CSV con BOM UTF-8 y saltos de línea de Windows', () => {
    expect(parseIssueInput('\uFEFFsummary,description\r\nLogin,Con OAuth\r\n')).toEqual([
      { title: 'Login', description: 'Con OAuth' },
    ]);
  });

  it('con solo la cabecera no hay tareas', () => {
    expect(parseIssueInput('summary,description')).toEqual([]);
  });

  it('tolera filas con menos celdas que la cabecera', () => {
    expect(parseIssueInput('summary,description,link\nLogin')).toEqual([{ title: 'Login' }]);
  });
});

describe('parseIssueInput — límites del servidor', () => {
  it('recorta con una elipsis un título que excede MAX_ISSUE_TITLE_LENGTH', () => {
    const [issue] = parseIssueInput('x'.repeat(MAX_ISSUE_TITLE_LENGTH + 50));

    expect(issue?.title).toHaveLength(MAX_ISSUE_TITLE_LENGTH);
    expect(issue?.title.endsWith('…')).toBe(true);
  });

  it('no toca un título que cabe justo', () => {
    const title = 'x'.repeat(MAX_ISSUE_TITLE_LENGTH);

    expect(parseIssueInput(title)).toEqual([{ title }]);
  });

  it('no parte un par sustituto al recortar', () => {
    const [issue] = parseIssueInput('😀'.repeat(MAX_ISSUE_TITLE_LENGTH));

    expect(issue?.title).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(issue?.title.length).toBeLessThanOrEqual(MAX_ISSUE_TITLE_LENGTH);
  });

  it('recorta la descripción de una fila de CSV que excede MAX_ISSUE_DESCRIPTION_LENGTH', () => {
    const [issue] = parseIssueInput(
      `summary,description\nLogin,${'d'.repeat(MAX_ISSUE_DESCRIPTION_LENGTH + 10)}`,
    );

    expect(issue?.description).toHaveLength(MAX_ISSUE_DESCRIPTION_LENGTH);
  });

  it('descarta un enlace de más de MAX_URL_LENGTH caracteres y conserva la tarea', () => {
    const link = `https://acme.test/${'a'.repeat(MAX_URL_LENGTH)}`;

    expect(parseIssueInput(`summary,link\nLogin,${link}`)).toEqual([{ title: 'Login' }]);
  });

  it('todo lo que sale del importador lo acepta el servidor aunque la entrada exceda los máximos', () => {
    const huge = [
      'x'.repeat(MAX_ISSUE_TITLE_LENGTH * 2),
      `summary,description,link\n${'t'.repeat(500)},${'d'.repeat(9000)},https://acme.test/${'a'.repeat(3000)}`,
    ];

    for (const text of huge) {
      for (const issue of parseIssueInput(text)) {
        expect(addIssueCommandSchema.safeParse(issue).success).toBe(true);
      }
    }
  });
});
