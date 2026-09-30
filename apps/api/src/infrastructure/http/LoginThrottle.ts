/**
 * Freno a la fuerza bruta sobre `POST /api/admin/session`: N fallos por IP dentro de la ventana
 * bloquean esa IP hasta que caduca. En memoria, como `GameVersionTracker`: con una sola instancia
 * no hace falta más, y un reinicio que lo vacíe solo regala un puñado de intentos.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; windowStartsAt: number }>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string, now: number): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (now - entry.windowStartsAt >= this.windowMs) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(key: string, now: number): void {
    const entry = this.failures.get(key);
    if (!entry || now - entry.windowStartsAt >= this.windowMs) {
      this.failures.set(key, { count: 1, windowStartsAt: now });
      return;
    }
    entry.count += 1;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
