import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerWarmup } from './serverWarmup.js';
import type { ServerStatus, ServerWarmup } from './serverWarmup.js';

type FetchStep = 'ok' | 'unavailable' | 'hang' | 'network-error';

/** Cada llamada consume un paso; el último se repite. `hang` solo termina al abortar. */
function scriptedFetch(steps: ReadonlyArray<FetchStep>): ReturnType<typeof vi.fn<typeof fetch>> {
  let call = 0;
  return vi.fn<typeof fetch>((_input, init) => {
    const step = steps[Math.min(call, steps.length - 1)];
    call += 1;
    if (step === 'ok') return Promise.resolve(new Response('{}', { status: 200 }));
    if (step === 'unavailable') return Promise.resolve(new Response('', { status: 503 }));
    if (step === 'network-error') return Promise.reject(new TypeError('Failed to fetch'));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  });
}

interface Setup {
  readonly warmup: ServerWarmup;
  readonly statuses: ServerStatus[];
  readonly fetchSpy: ReturnType<typeof scriptedFetch>;
}

function setup(steps: ReadonlyArray<FetchStep>): Setup {
  const statuses: ServerStatus[] = [];
  const fetchSpy = scriptedFetch(steps);
  const warmup = createServerWarmup({
    healthUrl: 'https://api.test/health',
    fetch: fetchSpy,
    onStatus: (status) => statuses.push(status),
  });
  return { warmup, statuses, fetchSpy };
}

describe('serverWarmup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pasa a ready con la primera respuesta 200 sin llegar a anunciar que despierta', async () => {
    const { warmup, statuses, fetchSpy } = setup(['ok']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(statuses).toEqual(['checking', 'ready']);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.test/health');
  });

  it('pasa a waking si a los 2 s no hay respuesta', async () => {
    const { warmup, statuses } = setup(['hang']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(1_900);
    expect(statuses).toEqual(['checking']);

    await vi.advanceTimersByTimeAsync(200);
    expect(statuses).toEqual(['checking', 'waking']);
  });

  it('reintenta con espera creciente y pasa a ready cuando la API contesta', async () => {
    const { warmup, statuses, fetchSpy } = setup(['hang', 'unavailable', 'network-error', 'ok']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(statuses).toEqual(['checking', 'waking', 'ready']);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('espera cada vez más entre intentos hasta un tope', async () => {
    const { warmup, fetchSpy } = setup(['unavailable']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(0);
    const callTimes: number[] = [0];
    let seen = fetchSpy.mock.calls.length;
    for (let elapsed = 0; elapsed < 20_000; elapsed += 100) {
      if (fetchSpy.mock.calls.length > seen) {
        callTimes.push(elapsed);
        seen = fetchSpy.mock.calls.length;
      }
      await vi.advanceTimersByTimeAsync(100);
    }

    const gaps = callTimes.slice(1).map((time, index) => time - (callTimes[index] ?? 0));
    expect(gaps.slice(0, 4)).toEqual([1_000, 2_000, 4_000, 5_000]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(5_100);
  });

  it('pasa a unreachable al agotar los reintentos y no sigue llamando', async () => {
    const { warmup, statuses, fetchSpy } = setup(['hang']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(95_000);

    expect(statuses).toEqual(['checking', 'waking', 'unreachable']);
    const callsAtGiveUp = fetchSpy.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(callsAtGiveUp);
  });

  it('retry tras unreachable vuelve a intentarlo directamente en waking', async () => {
    let healthy = false;
    const statuses: ServerStatus[] = [];
    const warmup = createServerWarmup({
      healthUrl: 'https://api.test/health',
      fetch: vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response('', { status: healthy ? 200 : 503 })),
      ),
      onStatus: (status) => statuses.push(status),
    });
    warmup.start();
    await vi.advanceTimersByTimeAsync(95_000);
    expect(statuses.at(-1)).toBe('unreachable');
    statuses.length = 0;

    healthy = true;
    warmup.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(statuses).toEqual(['waking', 'ready']);
  });

  it('start no lanza un segundo intento mientras hay uno en marcha ni cuando ya está ready', async () => {
    const { warmup, fetchSpy } = setup(['hang', 'ok']);

    warmup.start();
    warmup.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(10_000);
    const callsWhenReady = fetchSpy.mock.calls.length;
    warmup.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchSpy).toHaveBeenCalledTimes(callsWhenReady);
  });

  it('stop cancela los reintentos pendientes y no notifica más estados', async () => {
    const { warmup, statuses, fetchSpy } = setup(['unavailable']);

    warmup.start();
    await vi.advanceTimersByTimeAsync(500);
    warmup.stop();
    const callsWhenStopped = fetchSpy.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchSpy).toHaveBeenCalledTimes(callsWhenStopped);
    expect(statuses).toEqual(['checking']);
  });
});
