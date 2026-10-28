export type ServerStatus = 'checking' | 'waking' | 'ready' | 'unreachable';

export interface ServerWarmupOptions {
  readonly healthUrl: string;
  readonly fetch: typeof fetch;
  readonly onStatus: (status: ServerStatus) => void;
  /** Sin respuesta pasado este tiempo, deja de ser «comprobando» y se explica al usuario. */
  readonly wakingAfterMs?: number;
  /** Presupuesto total de reintentos: Render free tarda hasta ~1 min en arrancar en frío. */
  readonly giveUpAfterMs?: number;
  readonly attemptTimeoutMs?: number;
}

export interface ServerWarmup {
  /** No hace nada si ya hay un intento en marcha o el servidor ya respondió. */
  start: () => void;
  /** Tras `unreachable`: vuelve a intentarlo sin pasar otra vez por «comprobando». */
  retry: () => void;
  stop: () => void;
}

const WAKING_AFTER_MS = 2_000;
const GIVE_UP_AFTER_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 5_000;
const MAX_BACKOFF_MS = 5_000;

type Phase = 'idle' | 'running' | 'ready';

/**
 * Despierta la API pidiéndole `/health` hasta que conteste (ADR 0022). El reloj y el `fetch` entran
 * por parámetro/globales para que los tests lo recorran con temporizadores falsos.
 */
export function createServerWarmup(options: ServerWarmupOptions): ServerWarmup {
  const wakingAfterMs = options.wakingAfterMs ?? WAKING_AFTER_MS;
  const giveUpAfterMs = options.giveUpAfterMs ?? GIVE_UP_AFTER_MS;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS;

  let phase: Phase = 'idle';
  let generation = 0;
  let wakingTimer: ReturnType<typeof setTimeout> | undefined;

  async function probe(timeoutMs: number): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await options.fetch(options.healthUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function run(initial: ServerStatus): Promise<void> {
    phase = 'running';
    generation += 1;
    const mine = generation;
    const startedAt = Date.now();
    const isCurrent = (): boolean => generation === mine;

    options.onStatus(initial);
    if (initial === 'checking') {
      wakingTimer = setTimeout(() => {
        if (isCurrent()) options.onStatus('waking');
      }, wakingAfterMs);
    }

    for (let attempt = 0; ; attempt += 1) {
      const remaining = giveUpAfterMs - (Date.now() - startedAt);
      const answered = await probe(Math.max(1, Math.min(attemptTimeoutMs, remaining)));
      if (!isCurrent()) return;

      if (answered) {
        clearTimeout(wakingTimer);
        phase = 'ready';
        options.onStatus('ready');
        return;
      }

      const wait = Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS);
      if (Date.now() - startedAt + wait >= giveUpAfterMs) {
        clearTimeout(wakingTimer);
        phase = 'idle';
        options.onStatus('unreachable');
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
      if (!isCurrent()) return;
    }
  }

  return {
    start() {
      if (phase !== 'idle') return;
      void run('checking');
    },
    retry() {
      if (phase !== 'idle') return;
      void run('waking');
    },
    stop() {
      generation += 1;
      clearTimeout(wakingTimer);
      phase = 'idle';
    },
  };
}
