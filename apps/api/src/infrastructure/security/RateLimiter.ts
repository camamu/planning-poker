export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

export type RateLimitVerdict =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterMs: number };

/** Lo que ve quien se pasa: el mismo texto por HTTP (`message`) y por Socket.IO (evento `error`). */
export const RATE_LIMIT_MESSAGE =
  'Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.';

/** Para cortar un caso de uso en mitad de un handler de socket; `toErrorMessage` la traduce. */
export class RateLimitedError extends Error {
  constructor() {
    super(RATE_LIMIT_MESSAGE);
    this.name = 'RateLimitedError';
  }
}

const ALLOWED: RateLimitVerdict = { allowed: true };
/** Cota de memoria si alguien rota claves (IPs, sockets): pasado esto se olvidan las más antiguas. */
const DEFAULT_MAX_KEYS = 100_000;

interface Window {
  count: number;
  startedAt: number;
}

/**
 * Ventana fija por clave, en memoria. Sin temporizadores: el instante llega por parámetro (como en
 * `LoginThrottle`) y las ventanas vencidas se barren al pasar una ventana entera, así que las
 * pruebas no esperan y un servidor parado no acumula trabajo. Con una sola instancia no hace falta
 * estado compartido; un reinicio que vacíe los contadores solo regala una ventana (ADR 0031).
 *
 * Una petición rechazada no suma: seguir insistiendo no alarga el bloqueo.
 */
export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private nextSweepAt = 0;

  constructor(
    private readonly rule: RateLimitRule,
    private readonly maxKeys: number = DEFAULT_MAX_KEYS,
  ) {}

  consume(key: string, now: number): RateLimitVerdict {
    this.sweep(now);

    const current = this.windows.get(key);
    if (current === undefined || now - current.startedAt >= this.rule.windowMs) {
      // Borrar antes de insertar mantiene el orden del Map por inicio de ventana, que es el que
      // usa `evictOldest`.
      this.windows.delete(key);
      this.windows.set(key, { count: 1, startedAt: now });
      this.evictOldest();
      return ALLOWED;
    }
    if (current.count >= this.rule.limit) {
      return { allowed: false, retryAfterMs: current.startedAt + this.rule.windowMs - now };
    }
    current.count += 1;
    return ALLOWED;
  }

  get trackedKeys(): number {
    return this.windows.size;
  }

  private sweep(now: number): void {
    if (now < this.nextSweepAt) return;
    this.nextSweepAt = now + this.rule.windowMs;
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.rule.windowMs) this.windows.delete(key);
    }
  }

  private evictOldest(): void {
    for (const key of this.windows.keys()) {
      if (this.windows.size <= this.maxKeys) return;
      this.windows.delete(key);
    }
  }
}
