import { useGameStore } from '../../../shared/store/gameStore.js';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';

const REACTION_BAR = ['👏', '😂', '😱', '🤔', '🐔'];

export interface UseEmojiThrowResult {
  readonly mode: 'throw' | 'react';
  readonly armedEmoji: string | null;
  readonly emojisInFlight: ReadonlyArray<EmojiInFlight>;
  readonly reactionBar: ReadonlyArray<string>;
  readonly setMode: (mode: 'throw' | 'react') => void;
  /** En modo Lanzar arma el emoji (el siguiente clic en un asiento lo envía); en Reaccionar, lo lanza ya. */
  readonly pick: (emoji: string, ownParticipantId: string) => void;
  readonly throwAtSeat: (participantId: string) => void;
}

export function useEmojiThrow(): UseEmojiThrowResult {
  const mode = useGameStore((state) => state.emojiMode);
  const armedEmoji = useGameStore((state) => state.armedEmoji);
  const emojisInFlight = useGameStore((state) => state.emojisInFlight);
  const setEmojiMode = useGameStore((state) => state.setEmojiMode);
  const armEmoji = useGameStore((state) => state.armEmoji);
  const sendEmoji = useGameStore((state) => state.sendEmoji);

  return {
    mode,
    armedEmoji,
    emojisInFlight,
    reactionBar: REACTION_BAR,
    setMode: setEmojiMode,
    pick(emoji, ownParticipantId) {
      if (mode === 'react') {
        sendEmoji(ownParticipantId, emoji);
      } else {
        armEmoji(emoji);
      }
    },
    throwAtSeat(participantId) {
      if (!armedEmoji) return;
      sendEmoji(participantId, armedEmoji);
    },
  };
}
