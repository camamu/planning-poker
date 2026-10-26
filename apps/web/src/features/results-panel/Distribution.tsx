import type { RoundResultView } from '@pp/contracts';
import type { JSX } from 'react';
import { DistributionBar } from './DistributionBar.js';

export interface DistributionProps {
  readonly result: RoundResultView;
  readonly total: number;
}

export function Distribution({ result, total }: DistributionProps): JSX.Element {
  const entries = Object.entries(result.distribution).sort(([, a], [, b]) => b - a);
  return (
    <>
      {entries.map(([label, count]) => (
        <DistributionBar
          key={label}
          label={label}
          count={count}
          total={total}
          isMostVoted={label === result.mostVoted}
        />
      ))}
    </>
  );
}
