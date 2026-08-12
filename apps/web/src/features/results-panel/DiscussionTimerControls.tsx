import type { JSX } from 'react';
import { Button } from '../../design-system/index.js';
import { formatCountdown, useCountdown } from '../game-table/hooks/useCountdown.js';
import type { DiscussionTimerState } from '../../shared/store/gameStore.js';

export interface DiscussionTimerControlsProps {
  readonly roundId: string;
  readonly timer: DiscussionTimerState | null;
  readonly onStart: (roundId: string, seconds: number) => void;
  readonly onPause: (roundId: string) => void;
  readonly onResume: (roundId: string) => void;
  readonly onAddSeconds: (roundId: string, seconds: number) => void;
}

/** F8 — temporizador de discusión, arrancable en cualquier momento (docs/06-handoff-diseno.md). */
export function DiscussionTimerControls(props: DiscussionTimerControlsProps): JSX.Element {
  const active = props.timer && props.timer.roundId === props.roundId ? props.timer : null;
  const deadline = active?.running
    ? new Date(active.syncedAt + active.remainingMs).toISOString()
    : null;
  const ticking = useCountdown(deadline);
  const remainingMs = active
    ? active.running
      ? (ticking ?? active.remainingMs)
      : active.remainingMs
    : null;

  if (!active) {
    return (
      <Button
        variant="secondary"
        block
        onClick={() => {
          props.onStart(props.roundId, 300);
        }}
      >
        Arrancar temporizador de discusión
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 font-mono text-sm" style={{ color: 'var(--pp-muted)' }}>
        ⏱ {formatCountdown(remainingMs ?? 0)}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          if (active.running) props.onPause(props.roundId);
          else props.onResume(props.roundId);
        }}
      >
        {active.running ? 'Pausar' : 'Reanudar'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          props.onAddSeconds(props.roundId, 60);
        }}
      >
        +1 min
      </button>
    </div>
  );
}
