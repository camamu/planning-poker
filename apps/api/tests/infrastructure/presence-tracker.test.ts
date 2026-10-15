import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameId } from '../../src/domain/game/ids.js';
import type { Clock } from '../../src/domain/shared/Clock.js';
import { PresenceTracker } from '../../src/infrastructure/realtime/PresenceTracker.js';
import type { PresenceChange } from '../../src/infrastructure/realtime/PresenceTracker.js';

const GRACE_MS = 30_000;
const WARMUP_MS = 20_000;
const game = GameId.of('game-1');

class MutableClock implements Clock {
  constructor(private current: number) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

function onlineIds(tracker: PresenceTracker): string[] {
  return tracker.onlineParticipants(game).map((id) => id.value);
}

describe('PresenceTracker', () => {
  let clock: MutableClock;
  let tracker: PresenceTracker;
  let changes: PresenceChange[];

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new MutableClock(1_000_000);
    tracker = new PresenceTracker(clock, { graceMs: GRACE_MS, warmupMs: WARMUP_MS });
    changes = [];
    tracker.onChange((change) => changes.push(change));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marca como conectado a quien se une y avisa una sola vez', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.connect('s2', 'game-1', 'ana');

    expect(onlineIds(tracker)).toEqual(['ana']);
    expect(changes).toEqual([{ gameId: 'game-1', participantId: 'ana', online: true }]);
  });

  it('mantiene a alguien conectado durante el margen de gracia tras perder su socket', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.disconnect('s1');
    vi.advanceTimersByTime(GRACE_MS - 1);

    expect(onlineIds(tracker)).toEqual(['ana']);
  });

  it('lo da por desconectado al cumplirse el margen de gracia', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.disconnect('s1');
    vi.advanceTimersByTime(GRACE_MS);

    expect(onlineIds(tracker)).toEqual([]);
    expect(changes.at(-1)).toEqual({ gameId: 'game-1', participantId: 'ana', online: false });
  });

  it('no lo desconecta si vuelve a conectarse dentro del margen de gracia', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.disconnect('s1');
    vi.advanceTimersByTime(GRACE_MS / 2);
    tracker.connect('s2', 'game-1', 'ana');
    vi.advanceTimersByTime(GRACE_MS);

    expect(onlineIds(tracker)).toEqual(['ana']);
    expect(changes).toHaveLength(1);
  });

  it('sigue conectado mientras le quede algún socket (varias pestañas)', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.connect('s2', 'game-1', 'ana');
    tracker.disconnect('s1');
    vi.advanceTimersByTime(GRACE_MS * 2);

    expect(onlineIds(tracker)).toEqual(['ana']);
  });

  it('distingue a los participantes y a las partidas', () => {
    tracker.connect('s1', 'game-1', 'ana');
    tracker.connect('s2', 'game-1', 'bea');
    tracker.connect('s3', 'game-2', 'cleo');
    tracker.disconnect('s1');
    vi.advanceTimersByTime(GRACE_MS);

    expect(onlineIds(tracker)).toEqual(['bea']);
  });

  it('no se fía de la presencia durante el arranque en frío', () => {
    tracker.connect('s1', 'game-1', 'ana');

    expect(tracker.votingPresence(game)).toBeUndefined();

    clock.advance(WARMUP_MS);
    expect(tracker.votingPresence(game)?.map((id) => id.value)).toEqual(['ana']);
  });
});
