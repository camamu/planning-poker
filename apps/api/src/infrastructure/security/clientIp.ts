export interface ClientIpInput {
  /** La dirección del otro extremo de la conexión TCP: el último proxy, si lo hay. */
  readonly remoteAddress: string;
  readonly forwardedFor: string | undefined;
  /** Cuántos proxies de confianza hay entre el cliente y la API (`TRUST_PROXY_HOPS`). */
  readonly trustedHops: number;
}

/**
 * La IP del cliente contando proxies de confianza desde el final, igual que `trustProxy: <número>`
 * de Fastify (hay un test que compara ambos). Las entradas de `X-Forwarded-For` más a la izquierda
 * de lo que dejan atrás los proxies de confianza las escribe el cliente y se ignoran: Render no las
 * filtra, solo añade la suya (ADR 0031). Existe porque las conexiones de Socket.IO no pasan por
 * Fastify y no tienen `request.ip`.
 */
export function resolveClientIp(input: ClientIpInput): string {
  if (input.trustedHops <= 0 || !input.forwardedFor) return input.remoteAddress;

  const chain = [
    ...input.forwardedFor
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
    input.remoteAddress,
  ];
  return chain[Math.max(0, chain.length - 1 - input.trustedHops)] ?? input.remoteAddress;
}

/**
 * El valor para `trustProxy` de Fastify. No vale pasarle el número: en Fastify 5 un `trustProxy`
 * numérico no confía en nadie y `request.ip` seguiría siendo el del proxy, sin ningún error. Esta
 * función confía en los primeros `hops` saltos contando desde la conexión TCP, que es lo mismo que
 * hace `resolveClientIp`. Presupone que la API solo es alcanzable a través de esos proxies: un
 * cliente que llegara directo podría declarar saltos falsos en `X-Forwarded-For`.
 */
export function fastifyTrustProxy(
  hops: number,
): false | ((address: string, hop: number) => boolean) {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}
