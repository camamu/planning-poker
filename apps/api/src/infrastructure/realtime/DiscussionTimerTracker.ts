import type { WsDiscussionTimerControlCommandInput } from '@pp/contracts';

export interface DiscussionTimerSnapshot {
  readonly running: boolean;
  readonly remainingMs: number;
}

interface DiscussionTimerState {
  readonly running: boolean;
  readonly remainingMs: number;
  readonly deadline: Date | null;
}

const IDLE: DiscussionTimerState = { running: false, remainingMs: 0, deadline: null };

/**
 * F8 — temporizador de discusión compartido, en memoria, keyed por `roundId`. No es un hecho de
 * negocio del agregado `Game`: no genera evento de dominio, no se persiste, y perderlo en un
 * reinicio del servidor es una limitación aceptada (docs/adr/0005-extension-de-alcance-bloque-6.md
 * — mismo espíritu que `GameVersionTracker`).
 */
export class DiscussionTimerTracker {
  private readonly timers = new Map<string, DiscussionTimerState>();

  apply(
    roundId: string,
    action: WsDiscussionTimerControlCommandInput['action'],
    seconds: number | undefined,
    now: Date,
  ): DiscussionTimerSnapshot {
    const current = this.timers.get(roundId) ?? IDLE;
    const next = this.nextState(current, action, seconds, now);
    this.timers.set(roundId, next);
    return this.snapshotOf(next, now);
  }

  current(roundId: string, now: Date): DiscussionTimerSnapshot | null {
    const state = this.timers.get(roundId);
    return state ? this.snapshotOf(state, now) : null;
  }

  private nextState(
    current: DiscussionTimerState,
    action: WsDiscussionTimerControlCommandInput['action'],
    seconds: number | undefined,
    now: Date,
  ): DiscussionTimerState {
    switch (action) {
      case 'start': {
        const remainingMs = (seconds ?? 0) * 1000;
        return { running: true, remainingMs, deadline: new Date(now.getTime() + remainingMs) };
      }
      case 'pause':
        return { running: false, remainingMs: this.remainingAt(current, now), deadline: null };
      case 'resume': {
        if (current.running) return current;
        const remainingMs = this.remainingAt(current, now);
        return { running: true, remainingMs, deadline: new Date(now.getTime() + remainingMs) };
      }
      case 'reset':
        return IDLE;
      case 'addSeconds': {
        const remainingMs = this.remainingAt(current, now) + (seconds ?? 0) * 1000;
        return current.running
          ? { running: true, remainingMs, deadline: new Date(now.getTime() + remainingMs) }
          : { running: false, remainingMs, deadline: null };
      }
    }
  }

  private remainingAt(state: DiscussionTimerState, now: Date): number {
    if (!state.running || !state.deadline) return state.remainingMs;
    return Math.max(0, state.deadline.getTime() - now.getTime());
  }

  private snapshotOf(state: DiscussionTimerState, now: Date): DiscussionTimerSnapshot {
    return { running: state.running, remainingMs: this.remainingAt(state, now) };
  }
}
