import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { webhookEnvelopeSchema } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { signWebhookBody } from '../../src/infrastructure/security/webhookSignature.js';

/** `docs/08-webhooks.md` es la guía de quien configura el receptor: lo que dice tiene que funcionar. */
const doc = readFileSync(new URL('../../../../docs/08-webhooks.md', import.meta.url), 'utf8');

function blocks(language: string): string[] {
  const fence = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g');
  return [...doc.matchAll(fence)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

describe('docs/08-webhooks.md: ejemplos de cuerpos', () => {
  const examples = blocks('json').map((text): unknown => JSON.parse(text));

  it('cada ejemplo de cuerpo cumple el esquema publicado en contracts', () => {
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const parsed = webhookEnvelopeSchema.safeParse(example);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
  });

  it('documenta un ejemplo de cada uno de los cuatro eventos', () => {
    const events = examples.map((example) => webhookEnvelopeSchema.parse(example).event);

    expect([...events].sort()).toEqual(
      ['issue.estimated', 'issues.imported', 'ping', 'session.summary'].sort(),
    );
  });
});

describe('docs/08-webhooks.md: verificación de la firma', () => {
  const [snippet] = blocks('js');
  if (snippet === undefined) throw new Error('la guía no trae el fragmento de verificación');

  const code = snippet
    .replace(/^import .*$/m, '')
    .replace('export function', 'function')
    .concat('\nverifyPlanningPokerWebhook;');
  const verify: unknown = vm.runInNewContext(code, {
    createHmac,
    timingSafeEqual,
    Buffer,
    Date,
    Math,
    Number,
  });
  if (typeof verify !== 'function') throw new Error('el fragmento no define la función');

  const run = (...args: unknown[]): unknown => Reflect.apply(verify, undefined, args);

  const secret = 'secreto-del-webhook';
  const body = '{"version":1,"event":"ping"}';
  const now = (): string => Math.floor(Date.now() / 1000).toString();

  function headersFor(timestamp: string, signed = body, key = secret): Record<string, string> {
    return {
      'x-pp-timestamp': timestamp,
      'x-pp-signature': signWebhookBody(key, timestamp, signed),
    };
  }

  it('acepta una firma generada por la propia api', () => {
    expect(run(secret, headersFor(now()), body)).toBe(true);
  });

  it('rechaza un cuerpo modificado, un secreto distinto y cabeceras que faltan', () => {
    expect(run(secret, headersFor(now(), '{"version":1,"event":"issue.estimated"}'), body)).toBe(
      false,
    );
    expect(run('otro-secreto', headersFor(now()), body)).toBe(false);
    expect(run(secret, {}, body)).toBe(false);
    expect(run(secret, { 'x-pp-timestamp': now() }, body)).toBe(false);
  });

  it('rechaza un envío con más de cinco minutos de antigüedad', () => {
    const old = (Math.floor(Date.now() / 1000) - 301).toString();

    expect(run(secret, headersFor(old), body)).toBe(false);
  });

  it('acepta un envío dentro del margen de cinco minutos', () => {
    const recent = (Math.floor(Date.now() / 1000) - 299).toString();

    expect(run(secret, headersFor(recent), body)).toBe(true);
  });
});
