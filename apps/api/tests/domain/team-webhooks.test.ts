import {
  MAX_WEBHOOKS_PER_TEAM as CONTRACT_MAX,
  WEBHOOK_EVENTS as CONTRACT_EVENTS,
} from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import {
  MAX_WEBHOOKS_PER_TEAM,
  Team,
  TooManyWebhooksError,
  WebhookNotFoundError,
} from '../../src/domain/team/Team.js';
import { TeamId } from '../../src/domain/team/TeamId.js';
import { TeamName } from '../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../src/domain/team/TeamSlug.js';
import { Webhook, WebhookNeedsEventsError } from '../../src/domain/team/Webhook.js';
import {
  InvalidWebhookEventError,
  WEBHOOK_EVENTS,
  parseWebhookEvent,
} from '../../src/domain/team/WebhookEvent.js';
import { WebhookId } from '../../src/domain/team/WebhookId.js';
import {
  InsecureWebhookUrlError,
  InvalidWebhookUrlError,
  WebhookUrl,
} from '../../src/domain/team/WebhookUrl.js';

function makeTeam(): Team {
  return Team.create({
    id: TeamId.of('team-1'),
    slug: TeamSlug.of('backend-team'),
    name: TeamName.of('Backend Team'),
    tokenHash: 'hash-1',
  });
}

function withWebhook(team: Team, id: string, events: Parameters<Team['addWebhook']>[2]): Team {
  return team.addWebhook(
    WebhookId.of(id),
    WebhookUrl.of(`https://hooks.example/${id}`),
    events,
    `secreto-${id}`,
  );
}

describe('WebhookUrl', () => {
  it('un webhook solo acepta URLs https', () => {
    expect(() => WebhookUrl.of('http://hooks.example/entrada')).toThrow(InsecureWebhookUrlError);
    expect(() => WebhookUrl.of('ftp://hooks.example/entrada')).toThrow(InsecureWebhookUrlError);
  });

  it('rechaza algo que no es una URL', () => {
    expect(() => WebhookUrl.of('hooks.example/entrada')).toThrow(InvalidWebhookUrlError);
    expect(() => WebhookUrl.of('   ')).toThrow(InvalidWebhookUrlError);
  });

  it('acepta una URL https con ruta y parámetros y la guarda recortada', () => {
    const url = WebhookUrl.of('  https://hooks.example/a/b?token=abc  ');

    expect(url.value).toBe('https://hooks.example/a/b?token=abc');
  });
});

describe('WebhookEvent', () => {
  it('reconoce los eventos a los que se puede suscribir un webhook', () => {
    expect(parseWebhookEvent('issue.estimated')).toBe('issue.estimated');
    expect(parseWebhookEvent('issues.imported')).toBe('issues.imported');
    expect(parseWebhookEvent('session.summary')).toBe('session.summary');
  });

  it('el catálogo del dominio y el de contracts son el mismo (el dominio no puede importarlo)', () => {
    expect([...WEBHOOK_EVENTS]).toEqual([...CONTRACT_EVENTS]);
    expect(MAX_WEBHOOKS_PER_TEAM).toBe(CONTRACT_MAX);
  });

  it('rechaza un evento desconocido, también ping, que no se suscribe', () => {
    expect(() => parseWebhookEvent('ping')).toThrow(InvalidWebhookEventError);
    expect(() => parseWebhookEvent('issue.deleted')).toThrow(InvalidWebhookEventError);
  });
});

describe('Webhook', () => {
  const base = {
    id: WebhookId.of('hook-1'),
    url: WebhookUrl.of('https://hooks.example/1'),
    secret: 'secreto',
  };

  it('un webhook necesita al menos un evento', () => {
    expect(() => Webhook.create({ ...base, events: [] })).toThrow(WebhookNeedsEventsError);
  });

  it('un evento repetido cuenta una sola vez y se conserva el orden', () => {
    const webhook = Webhook.create({
      ...base,
      events: ['session.summary', 'issue.estimated', 'session.summary'],
    });

    expect(webhook.events).toEqual(['session.summary', 'issue.estimated']);
  });

  it('solo está suscrito a los eventos que se eligieron', () => {
    const webhook = Webhook.create({ ...base, events: ['issue.estimated'] });

    expect(webhook.isSubscribedTo('issue.estimated')).toBe(true);
    expect(webhook.isSubscribedTo('issues.imported')).toBe(false);
  });
});

describe('Team: webhooks', () => {
  it('un equipo nuevo no tiene webhooks', () => {
    expect(makeTeam().webhooks).toEqual([]);
  });

  it('permite añadir un webhook y no modifica el equipo original', () => {
    const team = makeTeam();

    const updated = withWebhook(team, 'a', ['issue.estimated']);

    expect(updated.webhooks.map((webhook) => webhook.id.value)).toEqual(['a']);
    expect(team.webhooks).toEqual([]);
  });

  it('un equipo no puede tener más de tres webhooks', () => {
    let team = makeTeam();
    for (const id of ['a', 'b', 'c']) team = withWebhook(team, id, ['issue.estimated']);

    expect(MAX_WEBHOOKS_PER_TEAM).toBe(3);
    expect(() => withWebhook(team, 'd', ['issue.estimated'])).toThrow(TooManyWebhooksError);
    expect(team.webhooks).toHaveLength(3);
  });

  it('al quitar uno se puede volver a añadir otro', () => {
    let team = makeTeam();
    for (const id of ['a', 'b', 'c']) team = withWebhook(team, id, ['issue.estimated']);

    team = team.removeWebhook(WebhookId.of('b'));
    team = withWebhook(team, 'd', ['issues.imported']);

    expect(team.webhooks.map((webhook) => webhook.id.value)).toEqual(['a', 'c', 'd']);
  });

  it('no permite quitar un webhook que no existe', () => {
    expect(() => makeTeam().removeWebhook(WebhookId.of('fantasma'))).toThrow(WebhookNotFoundError);
  });

  it('un webhook sin eventos no se añade al equipo', () => {
    expect(() => withWebhook(makeTeam(), 'a', [])).toThrow(WebhookNeedsEventsError);
  });

  it('webhooksFor devuelve solo los suscritos a ese evento', () => {
    let team = makeTeam();
    team = withWebhook(team, 'a', ['issue.estimated']);
    team = withWebhook(team, 'b', ['issue.estimated', 'session.summary']);
    team = withWebhook(team, 'c', ['issues.imported']);

    expect(team.webhooksFor('issue.estimated').map((webhook) => webhook.id.value)).toEqual([
      'a',
      'b',
    ]);
    expect(team.webhooksFor('session.summary').map((webhook) => webhook.id.value)).toEqual(['b']);
  });

  it('renombrar el equipo o cambiar su token conserva los webhooks', () => {
    const team = withWebhook(makeTeam(), 'a', ['issue.estimated']);

    const renamed = team.rename(TeamName.of('Otro nombre'));
    const rotated = team.rotateToken('hash-2');

    expect(renamed.webhooks).toHaveLength(1);
    expect(rotated.webhooks).toHaveLength(1);
  });

  it('findWebhook encuentra un webhook por id', () => {
    const team = withWebhook(makeTeam(), 'a', ['issue.estimated']);

    expect(team.findWebhook(WebhookId.of('a'))?.secret).toBe('secreto-a');
    expect(team.findWebhook(WebhookId.of('b'))).toBeUndefined();
  });
});
