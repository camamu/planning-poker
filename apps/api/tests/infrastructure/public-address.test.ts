import { describe, expect, it } from 'vitest';
import { isPublicAddress } from '../../src/infrastructure/webhooks/publicAddress.js';

describe('isPublicAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'red privada 10/8'],
    ['10.255.255.255', 'red privada 10/8'],
    ['172.16.0.1', 'red privada 172.16/12'],
    ['172.31.255.255', 'red privada 172.16/12'],
    ['192.168.1.10', 'red privada 192.168/16'],
    ['169.254.169.254', 'metadatos de la nube'],
    ['169.254.0.1', 'link-local'],
    ['100.64.0.1', 'CGNAT'],
    ['0.0.0.0', 'dirección sin especificar'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['198.18.0.1', 'pruebas de red'],
    ['::1', 'loopback IPv6'],
    ['::', 'sin especificar IPv6'],
    ['fe80::1', 'link-local IPv6'],
    ['fc00::1', 'ULA IPv6'],
    ['fd12:3456:789a::1', 'ULA IPv6'],
    ['ff02::1', 'multicast IPv6'],
    ['::ffff:127.0.0.1', 'IPv4 de loopback empaquetado en IPv6'],
    ['::ffff:7f00:1', 'IPv4 de loopback empaquetado en IPv6, en hexadecimal'],
    ['::ffff:169.254.169.254', 'metadatos empaquetados en IPv6'],
    ['64:ff9b::7f00:1', 'NAT64 hacia loopback'],
    ['2002:7f00:1::1', '6to4 hacia loopback'],
  ])('rechaza %s (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['93.184.216.34'],
    ['172.15.255.255'],
    ['172.32.0.1'],
    ['11.0.0.1'],
    ['169.253.0.1'],
    ['2606:4700:4700::1111'],
    ['2a00:1450:4001:81b::200e'],
  ])('acepta la dirección pública %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it('rechaza algo que no es una dirección IP', () => {
    for (const value of ['localhost', 'example.com', '', '999.1.1.1', '10.0.0']) {
      expect(isPublicAddress(value)).toBe(false);
    }
  });
});
