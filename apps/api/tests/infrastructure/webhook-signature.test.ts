import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signWebhookBody } from '../../src/infrastructure/security/webhookSignature.js';
import { RandomSecretGenerator } from '../../src/infrastructure/security/RandomSecretGenerator.js';

describe('signWebhookBody', () => {
  const body = '{"version":1,"event":"ping"}';

  it('es el HMAC-SHA256 de «timestamp.cuerpo» con el secreto, en hexadecimal y con prefijo sha256=', () => {
    const expected = createHmac('sha256', 'secreto').update(`1786100000.${body}`).digest('hex');

    expect(signWebhookBody('secreto', '1786100000', body)).toBe(`sha256=${expected}`);
  });

  it('cambia si cambia el secreto, la marca de tiempo o el cuerpo', () => {
    const reference = signWebhookBody('secreto', '1786100000', body);

    expect(signWebhookBody('otro', '1786100000', body)).not.toBe(reference);
    expect(signWebhookBody('secreto', '1786100001', body)).not.toBe(reference);
    expect(signWebhookBody('secreto', '1786100000', `${body} `)).not.toBe(reference);
  });
});

describe('RandomSecretGenerator', () => {
  it('genera secretos de 256 bits en hexadecimal y distintos cada vez', () => {
    const generator = new RandomSecretGenerator();

    const secrets = [generator.generate(), generator.generate(), generator.generate()];

    for (const secret of secrets) expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(secrets).size).toBe(3);
  });
});
