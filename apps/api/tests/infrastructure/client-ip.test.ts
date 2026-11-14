import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { fastifyTrustProxy, resolveClientIp } from '../../src/infrastructure/security/clientIp.js';

const PROXY = '10.0.0.1';

describe('resolveClientIp', () => {
  it('sin proxies de confianza ignora X-Forwarded-For y usa la dirección de la conexión', () => {
    expect(
      resolveClientIp({ remoteAddress: '8.8.8.8', forwardedFor: '1.1.1.1', trustedHops: 0 }),
    ).toBe('8.8.8.8');
  });

  it('con un proxy de confianza toma lo que vio ese proxy y no lo que declaró el cliente', () => {
    expect(
      resolveClientIp({
        remoteAddress: PROXY,
        forwardedFor: '6.6.6.6, 203.0.113.9',
        trustedHops: 1,
      }),
    ).toBe('203.0.113.9');
  });

  it('con dos proxies de confianza salta también el segundo', () => {
    expect(
      resolveClientIp({
        remoteAddress: PROXY,
        forwardedFor: '6.6.6.6, 203.0.113.9, 172.70.0.1',
        trustedHops: 2,
      }),
    ).toBe('203.0.113.9');
  });

  it('si la cadena es más corta que los saltos de confianza devuelve su primera entrada', () => {
    expect(
      resolveClientIp({ remoteAddress: PROXY, forwardedFor: '203.0.113.9', trustedHops: 5 }),
    ).toBe('203.0.113.9');
  });

  it('sin la cabecera usa la dirección de la conexión aunque haya proxies de confianza', () => {
    expect(resolveClientIp({ remoteAddress: PROXY, forwardedFor: undefined, trustedHops: 2 })).toBe(
      PROXY,
    );
  });

  it('da la misma IP que request.ip de Fastify para cualquier cadena y número de saltos', async () => {
    const chains = [undefined, '203.0.113.9', '6.6.6.6, 203.0.113.9', 'a, b, c, d'];
    for (const hops of [0, 1, 2, 3]) {
      const app = Fastify({ trustProxy: fastifyTrustProxy(hops) });
      app.get('/ip', (request) => ({ ip: request.ip }));
      for (const forwardedFor of chains) {
        const response = await app.inject({
          url: '/ip',
          remoteAddress: PROXY,
          headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
        });
        const fastifyIp = response.json<{ ip: string }>().ip;

        expect(resolveClientIp({ remoteAddress: PROXY, forwardedFor, trustedHops: hops })).toBe(
          fastifyIp,
        );
      }
      await app.close();
    }
  });
});
