import { BlockList, isIP } from 'node:net';

/**
 * Direcciones a las que un webhook nunca debe poder llamar: la red interna del servidor (en Render,
 * otros servicios privados), el loopback, los metadatos de la nube (`169.254.169.254`) y todo lo
 * que no es unicast público. Sin esto, cualquiera con el token de un equipo haría que la api llame
 * a servicios internos (ADR 0028).
 */
const BLOCKED = new BlockList();

/**
 * IPv4 empaquetado en IPv6: un DNS público no tiene motivo para devolverlo, y es la vía clásica de
 * colar `127.0.0.1` como `::ffff:127.0.0.1`. Va en su propia lista y solo se consulta con direcciones
 * IPv6: `BlockList` compara cualquier IPv4 como si estuviera empaquetado, así que en la lista general
 * esta regla bloquearía todo IPv4.
 */
const IPV4_MAPPED = new BlockList();
IPV4_MAPPED.addSubnet('::ffff:0:0', 96, 'ipv6');

const IPV4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV6: ReadonlyArray<readonly [string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

for (const [network, prefix] of IPV4) BLOCKED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of IPV6) BLOCKED.addSubnet(network, prefix, 'ipv6');

/** `false` también para algo que no es una dirección IP: ante la duda, no se llama. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6) return !IPV4_MAPPED.check(address, 'ipv6') && !BLOCKED.check(address, 'ipv6');
  return !BLOCKED.check(address, 'ipv4');
}
