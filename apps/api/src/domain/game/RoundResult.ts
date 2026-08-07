import type { CardValue } from '../deck/CardValue.js';

export class RoundResult {
  private constructor(
    readonly distribution: ReadonlyMap<string, number>,
    readonly average: number | null,
    readonly agreementPercentage: number,
    readonly mostVoted: CardValue | null,
    readonly isUnanimous: boolean,
  ) {}

  static from(votes: ReadonlyArray<CardValue>): RoundResult {
    const distribution = RoundResult.buildDistribution(votes);
    const mostVoted = RoundResult.computeMostVoted(votes, distribution);
    const mostVotedCount = mostVoted === null ? 0 : (distribution.get(mostVoted.raw) ?? 0);
    const agreementPercentage =
      votes.length === 0 ? 0 : Math.round((mostVotedCount / votes.length) * 100);

    return new RoundResult(
      distribution,
      RoundResult.computeAverage(votes),
      agreementPercentage,
      mostVoted,
      votes.length > 0 && agreementPercentage === 100,
    );
  }

  private static buildDistribution(votes: ReadonlyArray<CardValue>): ReadonlyMap<string, number> {
    const distribution = new Map<string, number>();
    for (const vote of votes) {
      distribution.set(vote.raw, (distribution.get(vote.raw) ?? 0) + 1);
    }
    return distribution;
  }

  private static computeMostVoted(
    votes: ReadonlyArray<CardValue>,
    distribution: ReadonlyMap<string, number>,
  ): CardValue | null {
    let winner: CardValue | null = null;
    let winnerCount = 0;
    for (const vote of votes) {
      const count = distribution.get(vote.raw) ?? 0;
      if (winner === null || count > winnerCount) {
        winner = vote;
        winnerCount = count;
      }
    }
    return winner;
  }

  private static computeAverage(votes: ReadonlyArray<CardValue>): number | null {
    const numericValues = votes
      .filter((vote) => vote.countsForAverage())
      .map((vote) => vote.numeric)
      .filter((numeric): numeric is number => numeric !== null);

    if (numericValues.length === 0) return null;
    const sum = numericValues.reduce((acc, value) => acc + value, 0);
    return sum / numericValues.length;
  }
}
