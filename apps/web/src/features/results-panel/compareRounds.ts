import type { PastRoundView, RoundVoteView } from '@pp/contracts';

export interface VoteChange {
  readonly participantId: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Solo cuenta quien votó en las dos rondas y cambió de carta: quien votó en una sola no ha
 * «cambiado» nada, y comparar su voto con una ausencia no dice nada útil a la mesa.
 */
export function voteChanges(
  previous: PastRoundView,
  current: ReadonlyArray<RoundVoteView>,
): VoteChange[] {
  const before = new Map(previous.votes.map((vote) => [vote.participantId, vote.card]));
  return current.flatMap((vote) => {
    const from = before.get(vote.participantId);
    if (from === undefined || vote.card === null || vote.card === from) return [];
    return [{ participantId: vote.participantId, from, to: vote.card }];
  });
}
