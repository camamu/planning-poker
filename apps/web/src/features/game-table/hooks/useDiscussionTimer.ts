import { useGameStore } from '../../../shared/store/gameStore.js';
import type { DiscussionTimerState } from '../../../shared/store/gameStore.js';

export interface UseDiscussionTimerResult {
  readonly timer: DiscussionTimerState | null;
  readonly start: (roundId: string, seconds: number) => void;
  readonly pause: (roundId: string) => void;
  readonly resume: (roundId: string) => void;
  readonly reset: (roundId: string) => void;
  readonly addSeconds: (roundId: string, seconds: number) => void;
}

export function useDiscussionTimer(): UseDiscussionTimerResult {
  const timer = useGameStore((state) => state.discussionTimer);
  const control = useGameStore((state) => state.controlDiscussionTimer);

  return {
    timer,
    start: (roundId, seconds) => {
      control(roundId, 'start', seconds);
    },
    pause: (roundId) => {
      control(roundId, 'pause');
    },
    resume: (roundId) => {
      control(roundId, 'resume');
    },
    reset: (roundId) => {
      control(roundId, 'reset');
    },
    addSeconds: (roundId, seconds) => {
      control(roundId, 'addSeconds', seconds);
    },
  };
}
