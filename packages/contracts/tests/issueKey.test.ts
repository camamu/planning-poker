import { describe, expect, it } from 'vitest';
import { isHttpUrl, issueKeyFromUrl } from '../src/issueKey.js';

describe('issueKeyFromUrl', () => {
  it('saca la clave de una tarea de Jira', () => {
    expect(issueKeyFromUrl('https://acme.atlassian.net/browse/ABC-123')).toBe('ABC-123');
  });

  it('saca la clave de Jira aunque cuelgue de un context path o lleve query y ancla', () => {
    expect(issueKeyFromUrl('https://jira.acme.test/jira/browse/PAY_X-7?focusedId=1#comment')).toBe(
      'PAY_X-7',
    );
  });

  it('saca repo#número de una issue de GitHub', () => {
    expect(issueKeyFromUrl('https://github.com/camamu/planning-poker/issues/42')).toBe(
      'planning-poker#42',
    );
  });

  it('saca la clave de una tarea de Linear aunque lleve el slug del título', () => {
    expect(issueKeyFromUrl('https://linear.app/acme/issue/ENG-12/arreglar-el-login')).toBe(
      'ENG-12',
    );
  });

  it('usa el último segmento del path en cualquier otro enlace', () => {
    expect(issueKeyFromUrl('https://wiki.acme.test/tareas/migrar-la-bd')).toBe('migrar-la-bd');
    expect(issueKeyFromUrl('https://wiki.acme.test/tareas/migrar-la-bd/')).toBe('migrar-la-bd');
  });

  it('decodifica los segmentos con caracteres escapados', () => {
    expect(issueKeyFromUrl('https://wiki.acme.test/tareas/migrar%20la%20BD')).toBe('migrar la BD');
  });

  it('no confunde una issue de GitHub sin número ni una página de Jira sin clave con una clave', () => {
    expect(issueKeyFromUrl('https://github.com/camamu/planning-poker/issues')).toBe('issues');
    expect(issueKeyFromUrl('https://acme.atlassian.net/browse/ABC')).toBe('ABC');
  });

  it('usa el host si el enlace no tiene path', () => {
    expect(issueKeyFromUrl('https://tareas.acme.test')).toBe('tareas.acme.test');
  });

  it('devuelve el texto recortado tal cual si no es un enlace http(s)', () => {
    expect(issueKeyFromUrl('  ABC-123  ')).toBe('ABC-123');
    expect(issueKeyFromUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('isHttpUrl', () => {
  it('acepta enlaces http y https, con espacios alrededor', () => {
    expect(isHttpUrl('https://acme.atlassian.net/browse/ABC-123')).toBe(true);
    expect(isHttpUrl('  http://localhost:3000/x ')).toBe(true);
  });

  it('rechaza lo que no es http(s): otros protocolos, texto suelto y vacío', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('ftp://acme.test/x')).toBe(false);
    expect(isHttpUrl('ABC-123')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});
